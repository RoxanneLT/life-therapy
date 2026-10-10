import { prisma } from "@/lib/prisma";
import { ownBookings, ownEmailLogs, ownRelationships, ownWhatsAppLogs, partnerBookings, receivedGifts } from "@/lib/popia/plan";

/**
 * Everything held about one client, decrypted, as one JSON document: the POPIA s23 access right
 * and the "portable format" the privacy policy (§8) promises. Pleks's export left payments out;
 * this one carries them, because the money is most of what a client asks about.
 *
 * Each model is read by its own top-level query, so the encryption extension in lib/prisma.ts
 * decrypts every row. Tokens that would let the holder act as the client are left out.
 *
 * Therapist's notes (session notes, admin notes) are included only when the admin chooses: PAIA
 * s30 lets a health practitioner withhold records whose disclosure could harm the client, and that
 * is a professional judgement, never a default.
 */
export async function exportClientData(studentId: string, includeTherapistNotes: boolean) {
  const student = await prisma.student.findUnique({ where: { id: studentId } });
  if (!student) return null;
  const by = { where: { studentId } };
  const { email } = student;

  const [intake, bookings, invoices, paymentRequests, orders, balance, credits, enrollments, certificates, relationships, acceptances, emails, whatsapp] =
    await Promise.all([
      prisma.clientIntake.findUnique(by),
      prisma.booking.findMany({ where: ownBookings(studentId, email), orderBy: { date: "asc" } }),
      prisma.invoice.findMany({ ...by, orderBy: { createdAt: "asc" } }),
      prisma.paymentRequest.findMany({ ...by, orderBy: { createdAt: "asc" } }),
      prisma.order.findMany({ ...by, include: { items: true }, orderBy: { createdAt: "asc" } }),
      prisma.sessionCreditBalance.findUnique(by),
      prisma.sessionCreditTransaction.findMany({ ...by, orderBy: { createdAt: "asc" } }),
      prisma.enrollment.findMany({ ...by, include: { course: { select: { title: true } } } }),
      prisma.certificate.findMany(by),
      prisma.clientRelationship.findMany({ where: ownRelationships(studentId), select: { relationshipType: true, relationshipLabel: true, createdAt: true } }),
      prisma.documentAcceptance.findMany({ ...by, select: { documentSlug: true, documentVersion: true, acceptedAt: true } }),
      prisma.emailLog.findMany({ where: ownEmailLogs(studentId, email), select: { templateKey: true, subject: true, status: true, sentAt: true }, orderBy: { sentAt: "asc" } }),
      prisma.whatsAppLog.findMany({ where: ownWhatsAppLogs(studentId, student.phone), select: { templateName: true, status: true, sentAt: true }, orderBy: { sentAt: "asc" } }),
    ]);

  // Everything else linked to them. The audit (`popia: the export reads every client-linked model`)
  // fails when a model gains a link to Student and no query here reads it.
  const [asPartner, giftsBought, giftsReceived, invitesSent, invitesReceived, commitments, moduleAccess, lectureProgress, courseNotes, quizAttempts, digitalProducts, cart, campaignProgress, dripProgress] =
    await Promise.all([
      // Another client's booking: only what concerns them, never the other client's details.
      prisma.booking.findMany({
        where: partnerBookings(email),
        select: { date: true, startTime: true, endTime: true, sessionType: true, status: true, couplesPartnerName: true, couplesPartnerEmail: true, couplesPartnerPhone: true },
        orderBy: { date: "asc" },
      }),
      prisma.gift.findMany({ where: { buyerId: studentId }, omit: { redeemToken: true }, orderBy: { createdAt: "asc" } }),
      prisma.gift.findMany({
        where: receivedGifts(studentId, email),
        select: { recipientName: true, recipientEmail: true, message: true, status: true, deliveryDate: true, redeemedAt: true, createdAt: true },
        orderBy: { createdAt: "asc" },
      }),
      prisma.relationshipInvite.findMany({ where: { fromStudentId: studentId }, omit: { token: true }, orderBy: { createdAt: "asc" } }),
      prisma.relationshipInvite.findMany({
        where: { OR: [{ toStudentId: studentId }, { toEmail: { equals: email, mode: "insensitive" } }] },
        select: { toName: true, toEmail: true, relationshipType: true, status: true, createdAt: true },
        orderBy: { createdAt: "asc" },
      }),
      prisma.commitmentAcknowledgement.findMany({ ...by, select: { version: true, acknowledgedAt: true } }),
      prisma.moduleAccess.findMany({ ...by, include: { module: { select: { title: true } } } }),
      prisma.lectureProgress.findMany({ ...by, include: { lecture: { select: { title: true } } } }),
      prisma.studentNote.findMany({ ...by, include: { lecture: { select: { title: true } } }, orderBy: { createdAt: "asc" } }),
      prisma.quizAttempt.findMany({ ...by, orderBy: { completedAt: "asc" } }),
      prisma.digitalProductAccess.findMany({ ...by, include: { digitalProduct: { select: { title: true } } } }),
      prisma.cart.findUnique({ ...by, include: { items: true } }),
      prisma.campaignProgress.findMany({ ...by, include: { campaign: { select: { name: true } } } }),
      prisma.dripProgress.findUnique(by),
    ]);

  const { unsubscribeToken: _u, supabaseUserId: _s, adminNotes, ...profile } = student;
  return {
    exportedAt: new Date().toISOString(),
    format: "life-therapy-client-export/1",
    profile: includeTherapistNotes ? { ...profile, adminNotes } : profile,
    intake: intake && (includeTherapistNotes ? intake : { ...intake, adminNotes: undefined }),
    bookings: bookings.map(({ confirmationToken: _c, sessionNotes, adminNotes: bookingAdminNotes, ...b }) =>
      includeTherapistNotes ? { ...b, sessionNotes, adminNotes: bookingAdminNotes } : b,
    ),
    bookingsAsPartner: asPartner,
    invoices,
    paymentRequests,
    orders: orders.map(({ paystackAccessCode: _a, ...o }) => o),
    gifts: { bought: giftsBought, received: giftsReceived },
    credits: { balance, transactions: credits },
    learning: { enrollments, moduleAccess, lectureProgress, courseNotes, quizAttempts, certificates, digitalProducts },
    cart,
    relationships: { linked: relationships, invitesSent, invitesReceived },
    consents: {
      ...pick(student, ["consentGiven", "consentDate", "consentMethod", "marketingOptIn", "newsletterOptIn", "smsOptIn", "emailOptOut"]),
      documentAcceptances: acceptances,
      commitmentAcknowledgements: commitments,
    },
    communications: { emails, whatsapp, campaignProgress, dripProgress },
  };
}

function pick<T extends object, K extends keyof T>(o: T, keys: K[]): Pick<T, K> {
  return Object.fromEntries(keys.map((k) => [k, o[k]])) as Pick<T, K>;
}
