import { prisma } from "@/lib/prisma";

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

  const [intake, bookings, invoices, paymentRequests, orders, balance, credits, enrollments, certificates, relationships, acceptances, emails, whatsapp] =
    await Promise.all([
      prisma.clientIntake.findUnique(by),
      prisma.booking.findMany({ ...by, orderBy: { date: "asc" } }),
      prisma.invoice.findMany({ ...by, orderBy: { createdAt: "asc" } }),
      prisma.paymentRequest.findMany({ ...by, orderBy: { createdAt: "asc" } }),
      prisma.order.findMany({ ...by, include: { items: true }, orderBy: { createdAt: "asc" } }),
      prisma.sessionCreditBalance.findUnique(by),
      prisma.sessionCreditTransaction.findMany({ ...by, orderBy: { createdAt: "asc" } }),
      prisma.enrollment.findMany({ ...by, include: { course: { select: { title: true } } } }),
      prisma.certificate.findMany(by),
      prisma.clientRelationship.findMany({ ...by, select: { relationshipType: true, relationshipLabel: true, createdAt: true } }),
      prisma.documentAcceptance.findMany({ ...by, select: { documentSlug: true, acceptedAt: true } }),
      prisma.emailLog.findMany({ ...by, select: { templateKey: true, subject: true, status: true, sentAt: true }, orderBy: { sentAt: "asc" } }),
      prisma.whatsAppLog.findMany({ ...by, select: { templateName: true, status: true, sentAt: true }, orderBy: { sentAt: "asc" } }),
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
    invoices,
    paymentRequests,
    orders: orders.map(({ paystackAccessCode: _a, ...o }) => o),
    credits: { balance, transactions: credits },
    enrollments,
    certificates,
    relationships,
    consents: { ...pick(student, ["consentGiven", "consentDate", "consentMethod", "marketingOptIn", "newsletterOptIn", "smsOptIn", "emailOptOut"]), documentAcceptances: acceptances },
    communications: { emails, whatsapp },
  };
}

function pick<T extends object, K extends keyof T>(o: T, keys: K[]): Pick<T, K> {
  return Object.fromEntries(keys.map((k) => [k, o[k]])) as Pick<T, K>;
}
