import { prisma } from "@/lib/prisma";
import { recordAudit } from "@/lib/audit";
import { calendarDate, saDateStr, saToday } from "@/lib/dates";
import { Prisma } from "@/lib/generated/prisma/client";
import {
  ERASED_FIRST_NAME,
  ERASED_LAST_NAME,
  ERASED_TEXT,
  MODEL_FATES,
  columnsWithFate,
  erasedEmail,
  type COLUMN_FATES,
} from "@/lib/popia/plan";
import { clinicalPurgeOps } from "@/lib/popia/purge-retained";

/** The erase columns of a model as nulls, then the placeholders its required columns need. */
function erased(model: keyof typeof COLUMN_FATES, required: Record<string, unknown> = {}) {
  return { ...Object.fromEntries(columnsWithFate(model, "erase").map((c) => [c, null])), ...required };
}

/** Five years on from a calendar day, per the privacy policy's retention promise. */
function fiveYearsAfter(day: Date): Date {
  const [y, m, d] = saDateStr(day).split("-");
  return calendarDate(`${Number(y) + 5}-${m}-${m === "02" && d === "29" ? "28" : d}`);
}

const ACTIVE = ["pending", "confirmed"] as const;
const HELD = ["confirmed", "completed", "no_show"] as const;

/**
 * Anonymise one client in place (lib/popia/plan.ts says what happens to every column, and why).
 *
 * Refuses rather than deciding for the admin when the erasure would leave something half-done:
 * an upcoming session (cancel it through the normal flow, which handles credits and the calendar),
 * an unpaid payment request (settle or void it), or another client billed to this one (reassign).
 *
 * The login goes first and the erasure fails closed if it cannot: a deleted login over an intact
 * record can be re-run; an anonymous record with a live login cannot be undone.
 */
export async function eraseClient(
  studentId: string,
  actorEmail: string,
): Promise<{ success: true; retainUntil: string | null; contactEmail: string } | { success: false; error: string }> {
  const student = await prisma.student.findUnique({
    where: { id: studentId },
    select: { id: true, email: true, phone: true, supabaseUserId: true, erasedAt: true },
  });
  if (!student) return { success: false, error: "That client no longer exists." };
  if (student.erasedAt) return { success: false, error: "This client has already been erased." };

  const mine: Prisma.BookingWhereInput = {
    OR: [{ studentId }, { studentId: null, clientEmail: { equals: student.email, mode: "insensitive" } }],
  };
  const today = calendarDate(saToday());

  const [upcoming, unpaid, dependants] = await Promise.all([
    prisma.booking.count({ where: { AND: [mine, { status: { in: [...ACTIVE] }, date: { gte: today } }] } }),
    prisma.paymentRequest.count({ where: { studentId, status: { in: ["pending", "overdue"] } } }),
    prisma.student.count({
      where: {
        id: { not: studentId },
        OR: [
          { individualBilledTo: { OR: [{ studentId }, { relatedStudentId: studentId }] } },
          { couplesBilledTo: { OR: [{ studentId }, { relatedStudentId: studentId }] } },
        ],
      },
    }),
  ]);
  if (upcoming) return { success: false, error: `Cancel this client's ${upcoming} upcoming session${upcoming === 1 ? "" : "s"} first, so credits and the calendar are handled.` };
  if (unpaid) return { success: false, error: `Settle or void this client's ${unpaid} unpaid payment request${unpaid === 1 ? "" : "s"} first.` };
  if (dependants) return { success: false, error: `This client pays for ${dependants} other client${dependants === 1 ? "" : "s"}. Reassign their billing first.` };

  if (student.supabaseUserId) {
    // Imported here, not at the top: the service-role client is built at import, and a client with
    // no login (most of them, and every db test) should not need its credentials.
    const { supabaseAdmin } = await import("@/lib/supabase-admin");
    const { error } = await supabaseAdmin.auth.admin.deleteUser(student.supabaseUserId);
    if (error && error.status !== 404) return { success: false, error: `Could not remove the client's login: ${error.message}` };
  }

  const last = await prisma.booking.findFirst({
    where: { AND: [mine, { status: { in: [...HELD] }, date: { lte: today } }] },
    orderBy: { date: "desc" },
    select: { date: true },
  });
  const retainUntil = last ? fiveYearsAfter(last.date) : null;
  const purgeNow = !retainUntil || retainUntil <= today;

  const email = student.email;
  const dead = erasedEmail(studentId);
  const nameless = `${ERASED_FIRST_NAME} ${ERASED_LAST_NAME}`;

  await prisma.$transaction([
    prisma.student.update({
      where: { id: studentId },
      data: {
        ...erased("student", { email: dead, firstName: ERASED_FIRST_NAME, lastName: ERASED_LAST_NAME, tags: Prisma.DbNull }),
        supabaseUserId: null,
        clientStatus: "archived",
        emailOptOut: true,
        emailPaused: true,
        newsletterOptIn: false,
        marketingOptIn: false,
        smsOptIn: false,
        sessionReminders: false,
        erasedAt: new Date(),
        erasedBy: actorEmail,
        retainUntil,
      } as Prisma.StudentUpdateInput,
    }),
    // Walk-in bookings matched by address are linked to the record, so the purge reaches them.
    prisma.booking.updateMany({
      where: mine,
      data: { ...erased("booking", { clientName: nameless, clientEmail: dead }), studentId } as Prisma.BookingUncheckedUpdateManyInput,
    }),
    prisma.booking.updateMany({
      where: { couplesPartnerEmail: { equals: email, mode: "insensitive" } },
      data: Object.fromEntries(columnsWithFate("booking", "partner").map((c) => [c, null])),
    }),
    prisma.emailLog.updateMany({
      where: { OR: [{ studentId }, { to: { equals: email, mode: "insensitive" } }] },
      data: erased("emailLog", { to: dead, subject: ERASED_TEXT, metadata: Prisma.DbNull }) as Prisma.EmailLogUpdateManyMutationInput,
    }),
    prisma.whatsAppLog.updateMany({
      where: { OR: [{ studentId }, ...(student.phone ? [{ to: student.phone }] : [])] },
      data: erased("whatsAppLog", { to: ERASED_TEXT, metadata: Prisma.DbNull }) as Prisma.WhatsAppLogUpdateManyMutationInput,
    }),
    prisma.gift.updateMany({
      where: { OR: [{ recipientId: studentId }, { recipientEmail: { equals: email, mode: "insensitive" } }] },
      data: erased("gift", { recipientEmail: dead, recipientName: ERASED_TEXT }) as Prisma.GiftUpdateManyMutationInput,
    }),
    prisma.studentNote.deleteMany({ where: { studentId } }),
    prisma.quizAttempt.deleteMany({ where: { studentId } }),
    prisma.clientRelationship.deleteMany({ where: { OR: [{ studentId }, { relatedStudentId: studentId }] } }),
    prisma.relationshipInvite.deleteMany({
      where: { OR: [{ fromStudentId: studentId }, { toStudentId: studentId }, { toEmail: { equals: email, mode: "insensitive" } }] },
    }),
    prisma.cart.deleteMany({ where: { studentId } }),
    prisma.dripProgress.deleteMany({ where: { studentId } }),
    prisma.campaignProgress.deleteMany({ where: { studentId } }),
    ...(purgeNow ? clinicalPurgeOps(studentId) : []),
  ]);

  // Ids and column names only: the audit row must not put back what the erasure took out.
  // The durable record is erasedAt/erasedBy on the row itself; this one can be lost (lib/audit.ts).
  await recordAudit({
    action: "client_erased",
    entityType: "student",
    entityId: studentId,
    actorEmail,
    metadata: {
      retainUntil: retainUntil ? saDateStr(retainUntil) : null,
      clinicalPurged: purgeNow,
      loginRemoved: Boolean(student.supabaseUserId),
      deletedModels: Object.keys(MODEL_FATES).filter((m) => MODEL_FATES[m] === "delete"),
      // Paystack, Resend, Outlook and Meta are cleaned by hand; a client_erasure_external_done
      // row closes this (lib/popia/external-holders.ts).
      externalCleanup: "pending",
    },
  });

  // The address is returned once, for the admin to find this client at Resend and Paystack. It is
  // gone from every row now, so this is the last place it exists.
  return { success: true, retainUntil: retainUntil && !purgeNow ? saDateStr(retainUntil) : null, contactEmail: student.email };
}
