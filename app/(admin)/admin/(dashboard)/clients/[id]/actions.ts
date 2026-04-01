"use server";

import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { generateAndStoreInvoicePDF } from "@/lib/generate-invoice-pdf";
import { sendInvoiceEmail } from "@/lib/send-invoice";
import { getUnbilledBookings } from "@/lib/generate-payment-requests";
import { getSiteSettings } from "@/lib/settings";
import { resolveBillingContact, getSessionRate, calculateInvoiceTotals, getBillingPeriod, type BillingContact } from "@/lib/billing";
import type { InvoiceLineItem } from "@/lib/billing-types";
import { format } from "date-fns";
import { initializeTransaction } from "@/lib/paystack";
import type { Booking, Student } from "@/lib/generated/prisma/client";

/** Auto-activate a payer if they're inactive but the billed client is active */
async function autoActivatePayerIfNeeded(billedClientId: string, payerId: string) {
  const [billedClient, payer] = await Promise.all([
    prisma.student.findUnique({ where: { id: billedClientId }, select: { clientStatus: true } }),
    prisma.student.findUnique({ where: { id: payerId }, select: { clientStatus: true } }),
  ]);
  if (billedClient?.clientStatus === "active" && payer?.clientStatus === "inactive") {
    await prisma.student.update({
      where: { id: payerId },
      data: { clientStatus: "active" },
    });
    revalidatePath(`/admin/clients/${payerId}`);
  }
}

// ────────────────────────────────────────────────────────────
// Create an empty intake assessment for a client
// ────────────────────────────────────────────────────────────

export async function createIntakeAction(studentId: string) {
  await requireRole("super_admin");

  await prisma.clientIntake.create({
    data: {
      studentId,
      lastEditedBy: "admin",
      lastEditedAt: new Date(),
    },
  });

  revalidatePath(`/admin/clients/${studentId}`);
}

// ────────────────────────────────────────────────────────────
// Update intake assessment (toggle chips + admin notes)
// ────────────────────────────────────────────────────────────

export async function updateIntakeAction(
  studentId: string,
  data: {
    behaviours: string[];
    feelings: string[];
    symptoms: string[];
    otherBehaviours?: string;
    otherFeelings?: string;
    otherSymptoms?: string;
    adminNotes?: string;
  },
) {
  await requireRole("super_admin");

  await prisma.clientIntake.upsert({
    where: { studentId },
    create: {
      studentId,
      behaviours: data.behaviours,
      feelings: data.feelings,
      symptoms: data.symptoms,
      otherBehaviours: data.otherBehaviours || null,
      otherFeelings: data.otherFeelings || null,
      otherSymptoms: data.otherSymptoms || null,
      adminNotes: data.adminNotes || null,
      lastEditedBy: "admin",
      lastEditedAt: new Date(),
    },
    update: {
      behaviours: data.behaviours,
      feelings: data.feelings,
      symptoms: data.symptoms,
      otherBehaviours: data.otherBehaviours || null,
      otherFeelings: data.otherFeelings || null,
      otherSymptoms: data.otherSymptoms || null,
      adminNotes: data.adminNotes || null,
      lastEditedBy: "admin",
      lastEditedAt: new Date(),
    },
  });

  revalidatePath(`/admin/clients/${studentId}`);
}

// ────────────────────────────────────────────────────────────
// Sessions — Mark No-Show
// ────────────────────────────────────────────────────────────

export async function markNoShowAction(bookingId: string, studentId: string) {
  await requireRole("super_admin");

  await prisma.booking.update({
    where: { id: bookingId },
    data: { status: "no_show" },
  });

  // Forfeit the credit if the client has a credit balance
  const balance = await prisma.sessionCreditBalance.findUnique({
    where: { studentId },
  });
  if (balance && balance.balance > 0) {
    await prisma.$transaction([
      prisma.sessionCreditBalance.update({
        where: { studentId },
        data: { balance: { decrement: 1 } },
      }),
      prisma.sessionCreditTransaction.create({
        data: {
          studentId,
          type: "used",
          amount: -1,
          balanceAfter: balance.balance - 1,
          description: "No-show forfeit",
          bookingId,
        },
      }),
    ]);
  }

  revalidatePath(`/admin/clients/${studentId}`);
}

// ────────────────────────────────────────────────────────────
// Sessions — Admin Cancel
// ────────────────────────────────────────────────────────────

export async function adminCancelBookingAction(
  bookingId: string,
  studentId: string,
  refundCredit: boolean,
) {
  await requireRole("super_admin");

  await prisma.booking.update({
    where: { id: bookingId },
    data: {
      status: "cancelled",
      cancelledAt: new Date(),
      cancelledBy: "admin",
      isLateCancel: !refundCredit,
      creditRefunded: refundCredit,
    },
  });

  if (refundCredit) {
    const balance = await prisma.sessionCreditBalance.findUnique({
      where: { studentId },
    });
    if (balance) {
      await prisma.$transaction([
        prisma.sessionCreditBalance.update({
          where: { studentId },
          data: { balance: { increment: 1 } },
        }),
        prisma.sessionCreditTransaction.create({
          data: {
            studentId,
            type: "refund",
            amount: 1,
            balanceAfter: balance.balance + 1,
            description: "Admin cancel — credit refunded",
            bookingId,
          },
        }),
      ]);
    }
  }

  revalidatePath(`/admin/clients/${studentId}`);
}

export async function adminLateCancelWithFeeAction(
  bookingId: string,
  studentId: string,
) {
  await requireRole("super_admin");

  const booking = await prisma.booking.findUnique({ where: { id: bookingId } });
  if (!booking) throw new Error("Booking not found");

  await prisma.booking.update({
    where: { id: bookingId },
    data: {
      status: "cancelled",
      cancelledAt: new Date(),
      cancelledBy: "admin",
      isLateCancel: true,
      creditRefunded: false,
      billingNote: "(late cancel — fee charged)",
    },
  });

  if (booking.priceZarCents > 0) {
    const { createManualInvoice } = await import("@/lib/create-invoice");
    const { generateAndStoreInvoicePDF } = await import("@/lib/generate-invoice-pdf");
    const { sendInvoiceEmail } = await import("@/lib/send-invoice");
    const { getSessionTypeConfig } = await import("@/lib/booking-config");
    const { format } = await import("date-fns");

    const cfg = getSessionTypeConfig(booking.sessionType);
    const dateStr = format(new Date(booking.date), "d MMM yyyy");

    const invoice = await createManualInvoice({
      type: "late_cancel",
      studentId,
      paymentMethod: "eft",
      lineItems: [
        {
          description: `Late Cancellation Fee — ${cfg.label}`,
          subLine: `${dateStr}, ${booking.startTime}–${booking.endTime} (cancelled within 24h)`,
          quantity: 1,
          unitPriceCents: booking.priceZarCents,
          discountCents: 0,
          discountPercent: 0,
          totalCents: booking.priceZarCents,
        },
      ],
    });

    await generateAndStoreInvoicePDF(invoice.id).catch(console.error);
    await sendInvoiceEmail(invoice.id).catch(console.error);
  }

  revalidatePath(`/admin/clients/${studentId}`);
}

// ────────────────────────────────────────────────────────────
// Purchases — Grant Credits
// ────────────────────────────────────────────────────────────

export async function grantCreditsAction(
  studentId: string,
  amount: number,
  reason: string,
) {
  await requireRole("super_admin");
  if (amount < 1 || amount > 20) throw new Error("Amount must be 1-20");

  const balance = await prisma.sessionCreditBalance.upsert({
    where: { studentId },
    create: { studentId, balance: amount },
    update: { balance: { increment: amount } },
  });

  await prisma.sessionCreditTransaction.create({
    data: {
      studentId,
      type: "admin_grant",
      amount,
      balanceAfter: balance.balance,
      description: reason.trim() || "Admin grant",
    },
  });

  revalidatePath(`/admin/clients/${studentId}`);
}

// ────────────────────────────────────────────────────────────
// Purchases — Enrol in Course
// ────────────────────────────────────────────────────────────

export async function enrolInCourseAction(studentId: string, courseId: string) {
  await requireRole("super_admin");

  await prisma.enrollment.create({
    data: {
      studentId,
      courseId,
      source: "admin_grant",
    },
  });

  revalidatePath(`/admin/clients/${studentId}`);
}

// ────────────────────────────────────────────────────────────
// Communications — Update single comm preference
// ────────────────────────────────────────────────────────────

const ALLOWED_COMM_FIELDS = [
  "newsletterOptIn",
  "marketingOptIn",
  "smsOptIn",
  "sessionReminders",
  "emailOptOut",
] as const;

export async function updateCommPrefAction(
  studentId: string,
  field: string,
  value: boolean,
) {
  await requireRole("super_admin");
  if (!ALLOWED_COMM_FIELDS.includes(field as (typeof ALLOWED_COMM_FIELDS)[number])) {
    throw new Error("Invalid field");
  }

  await prisma.student.update({
    where: { id: studentId },
    data: { [field]: value },
  });

  revalidatePath(`/admin/clients/${studentId}`);
}

// ────────────────────────────────────────────────────────────
// Communications — Drip sequence controls
// ────────────────────────────────────────────────────────────

export async function pauseDripAction(studentId: string) {
  await requireRole("super_admin");
  await prisma.dripProgress.update({
    where: { studentId },
    data: { isPaused: true },
  });
  revalidatePath(`/admin/clients/${studentId}`);
}

export async function resumeDripAction(studentId: string) {
  await requireRole("super_admin");
  await prisma.dripProgress.update({
    where: { studentId },
    data: { isPaused: false },
  });
  revalidatePath(`/admin/clients/${studentId}`);
}

export async function resetDripAction(studentId: string) {
  await requireRole("super_admin");
  await prisma.dripProgress.update({
    where: { studentId },
    data: { currentStep: 0, completedAt: null },
  });
  revalidatePath(`/admin/clients/${studentId}`);
}

// ────────────────────────────────────────────────────────────
// Communications — Update tags
// ────────────────────────────────────────────────────────────

export async function updateTagsAction(studentId: string, tags: string[]) {
  await requireRole("super_admin");
  await prisma.student.update({
    where: { id: studentId },
    data: { tags },
  });
  revalidatePath(`/admin/clients/${studentId}`);
}

// ────────────────────────────────────────────────────────────
// Purchases — Fetch available courses for enrolment dialog
// ────────────────────────────────────────────────────────────

export async function getAvailableCoursesAction(studentId: string) {
  await requireRole("super_admin");

  const enrolled = await prisma.enrollment.findMany({
    where: { studentId },
    select: { courseId: true },
  });
  const enrolledIds = new Set(enrolled.map((e) => e.courseId));

  const courses = await prisma.course.findMany({
    where: { isPublished: true },
    select: { id: true, title: true },
    orderBy: { title: "asc" },
  });

  return courses.filter((c) => !enrolledIds.has(c.id));
}

// ────────────────────────────────────────────────────────────
// Billing — Update billing type
// ────────────────────────────────────────────────────────────

export async function updateBillingTypeAction(studentId: string, billingType: string) {
  await requireRole("super_admin");
  if (!["prepaid", "postpaid"].includes(billingType)) throw new Error("Invalid billing type");

  await prisma.student.update({
    where: { id: studentId },
    data: { billingType },
  });

  revalidatePath(`/admin/clients/${studentId}`);
}

// ────────────────────────────────────────────────────────────
// Billing — Update billing email
// ────────────────────────────────────────────────────────────

export async function updateBillingEmailAction(studentId: string, email: string) {
  await requireRole("super_admin");

  await prisma.student.update({
    where: { id: studentId },
    data: { billingEmail: email.trim() || null },
  });

  revalidatePath(`/admin/clients/${studentId}`);
}

// ────────────────────────────────────────────────────────────
// Billing — Update standing discount
// ────────────────────────────────────────────────────────────

export async function updateStandingDiscountAction(
  studentId: string,
  percent: number | null,
  fixed: number | null,
) {
  await requireRole("super_admin");

  await prisma.student.update({
    where: { id: studentId },
    data: {
      standingDiscountPercent: percent,
      standingDiscountFixed: fixed,
    },
  });

  revalidatePath(`/admin/clients/${studentId}`);
}

// ────────────────────────────────────────────────────────────
// Relationships — Search clients
// ────────────────────────────────────────────────────────────

export async function searchClientsAction(search: string) {
  await requireRole("super_admin");

  if (!search || search.trim().length < 2) return [];

  return prisma.student.findMany({
    where: {
      OR: [
        { firstName: { contains: search, mode: "insensitive" } },
        { lastName: { contains: search, mode: "insensitive" } },
        { email: { contains: search, mode: "insensitive" } },
      ],
    },
    select: { id: true, firstName: true, lastName: true, email: true },
    take: 20,
    orderBy: { firstName: "asc" },
  });
}

// ────────────────────────────────────────────────────────────
// Relationships — Add relationship
// ────────────────────────────────────────────────────────────

export async function addRelationshipAction(data: {
  studentId: string;
  relatedStudentId?: string;
  billingEntityId?: string;
  relationshipType: string;
  relationshipLabel?: string;
}) {
  await requireRole("super_admin");

  await prisma.clientRelationship.create({
    data: {
      studentId: data.studentId,
      relatedStudentId: data.relatedStudentId || null,
      billingEntityId: data.billingEntityId || null,
      relationshipType: data.relationshipType,
      relationshipLabel: data.relationshipLabel || null,
    },
  });

  revalidatePath(`/admin/clients/${data.studentId}`);
}

// ────────────────────────────────────────────────────────────
// Relationships — Create new client + link relationship
// ────────────────────────────────────────────────────────────

const INVERSE_REL: Record<string, string> = {
  parent: "child",
  child: "parent",
  guardian: "dependent",
  dependent: "guardian",
  partner: "partner",
  sibling: "sibling",
  other: "other",
};

export async function createClientAndLinkRelationshipAction(data: {
  parentClientId: string;
  firstName: string;
  lastName: string;
  isMinor: boolean;
  email?: string;
  dateOfBirth?: string;
  gender?: string;
  relationshipType: string;
  relationshipLabel?: string;
}) {
  await requireRole("super_admin");

  // Determine email
  let email = data.email?.trim().toLowerCase();
  if (!email && data.isMinor) {
    email = `minor_${Date.now()}_${Math.random().toString(36).slice(2, 8)}@noemail.internal`;
  }
  if (!email) {
    throw new Error("Email is required for non-minor clients.");
  }

  // Check for duplicates (skip placeholders)
  if (!email.endsWith("@noemail.internal")) {
    const existing = await prisma.student.findUnique({
      where: { email },
      select: { id: true },
    });
    if (existing) {
      throw new Error("A client with this email already exists.");
    }
  }

  // Create the new client
  const newClient = await prisma.student.create({
    data: {
      firstName: data.firstName.trim(),
      lastName: data.lastName.trim(),
      email,
      dateOfBirth: data.dateOfBirth ? new Date(data.dateOfBirth) : null,
      gender: data.gender?.trim() || null,
      clientStatus: "active",
      source: "manual",
      convertedAt: new Date(),
    },
  });

  // Initialize credit balance
  await prisma.sessionCreditBalance.create({
    data: { studentId: newClient.id, balance: 0 },
  });

  // Create bidirectional relationships
  const forwardRel = await prisma.clientRelationship.create({
    data: {
      studentId: data.parentClientId,
      relatedStudentId: newClient.id,
      relationshipType: data.relationshipType,
      relationshipLabel: data.relationshipLabel || null,
    },
  });

  const inverseType = INVERSE_REL[data.relationshipType] || data.relationshipType;
  await prisma.clientRelationship.create({
    data: {
      studentId: newClient.id,
      relatedStudentId: data.parentClientId,
      relationshipType: inverseType,
      relationshipLabel: null,
    },
  });

  // If creating a child/minor, auto-set billing to the parent
  if (data.relationshipType === "parent" || data.relationshipType === "guardian") {
    await prisma.student.update({
      where: { id: newClient.id },
      data: { individualBilledToId: forwardRel.id },
    });
  }

  revalidatePath(`/admin/clients/${data.parentClientId}`);
  revalidatePath(`/admin/clients/${newClient.id}`);
  revalidatePath("/admin/clients");
  return { clientId: newClient.id };
}

// ────────────────────────────────────────────────────────────
// Relationships — Remove relationship
// ────────────────────────────────────────────────────────────

export async function removeRelationshipAction(relationshipId: string, studentId: string) {
  await requireRole("super_admin");

  await prisma.clientRelationship.delete({
    where: { id: relationshipId },
  });

  revalidatePath(`/admin/clients/${studentId}`);
}

// ────────────────────────────────────────────────────────────
// Relationships — Update relationship
// ────────────────────────────────────────────────────────────

export async function updateRelationshipAction(
  relationshipId: string,
  studentId: string,
  data: {
    relationshipType: string;
    relationshipLabel?: string;
  },
) {
  await requireRole("super_admin");

  await prisma.clientRelationship.update({
    where: { id: relationshipId },
    data: {
      relationshipType: data.relationshipType,
      relationshipLabel: data.relationshipLabel || null,
    },
  });

  revalidatePath(`/admin/clients/${studentId}`);
}

// ────────────────────────────────────────────────────────────
// Billing — Update billing assignment (per-session-type)
// ────────────────────────────────────────────────────────────

/** Assign someone else as couples payer — clear their billing (they're the payer) */
async function assignCouplesPayer(studentId: string, relationshipId: string) {
  const rel = await prisma.clientRelationship.findUniqueOrThrow({
    where: { id: relationshipId },
  });
  const otherStudentId = rel.studentId === studentId
    ? rel.relatedStudentId
    : rel.studentId;

  await prisma.student.update({
    where: { id: studentId },
    data: { couplesBilledToId: relationshipId },
  });

  if (otherStudentId) {
    await prisma.student.update({
      where: { id: otherStudentId },
      data: { couplesBilledToId: null },
    });
    revalidatePath(`/admin/clients/${otherStudentId}`);
  }
}

/** Set self as couples payer — mirror billing to the other person */
async function assignCouplesSelf(studentId: string) {
  const current = await prisma.student.findUniqueOrThrow({
    where: { id: studentId },
    select: { couplesBilledToId: true },
  });

  if (current.couplesBilledToId) {
    const rel = await prisma.clientRelationship.findUniqueOrThrow({
      where: { id: current.couplesBilledToId },
    });
    const otherStudentId = rel.studentId === studentId
      ? rel.relatedStudentId
      : rel.studentId;

    if (otherStudentId) {
      await prisma.student.update({
        where: { id: otherStudentId },
        data: { couplesBilledToId: current.couplesBilledToId },
      });
      revalidatePath(`/admin/clients/${otherStudentId}`);
    }
  }

  await prisma.student.update({
    where: { id: studentId },
    data: { couplesBilledToId: null },
  });
}

export async function updateBillingAssignmentAction(
  studentId: string,
  sessionType: "individual" | "couples",
  relationshipId: string | null,
) {
  await requireRole("super_admin");

  // Validate: if relationshipId is provided, ensure it's a relationship involving this student
  if (relationshipId) {
    const rel = await prisma.clientRelationship.findUniqueOrThrow({
      where: { id: relationshipId },
    });
    if (rel.relatedStudentId !== studentId && rel.studentId !== studentId) {
      throw new Error("Invalid relationship for this client");
    }

    // Auto-activate the payer if they're inactive and the billed client is active
    const payerId = rel.studentId === studentId ? rel.relatedStudentId : rel.studentId;
    if (payerId) {
      await autoActivatePayerIfNeeded(studentId, payerId);
    }
  }

  if (sessionType === "individual") {
    await prisma.student.update({
      where: { id: studentId },
      data: { individualBilledToId: relationshipId },
    });
  } else if (relationshipId) {
    await assignCouplesPayer(studentId, relationshipId);
  } else {
    await assignCouplesSelf(studentId);
  }

  revalidatePath(`/admin/clients/${studentId}`);
}

// ────────────────────────────────────────────────────────────
// Relationships — Create billing entity
// ────────────────────────────────────────────────────────────

export async function createBillingEntityAction(data: {
  name: string;
  email: string;
  contactPerson?: string;
  phone?: string;
  vatNumber?: string;
  address?: string;
}) {
  await requireRole("super_admin");

  return prisma.billingEntity.create({
    data: {
      name: data.name,
      email: data.email,
      contactPerson: data.contactPerson || null,
      phone: data.phone || null,
      vatNumber: data.vatNumber || null,
      address: data.address || null,
    },
  });
}

// ────────────────────────────────────────────────────────────
// Invoices — Mark as paid
// ────────────────────────────────────────────────────────────

export async function markInvoicePaidAction(
  invoiceId: string,
  method: string,
  reference: string | undefined,
  studentId: string,
) {
  await requireRole("super_admin");

  await prisma.invoice.update({
    where: { id: invoiceId },
    data: {
      status: "paid",
      paymentMethod: method,
      eftReference: method === "eft" ? reference : undefined,
      paidAt: new Date(),
    },
  });

  // If linked to a payment request, mark it paid too
  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    select: { paymentRequestId: true, totalCents: true },
  });
  if (invoice?.paymentRequestId) {
    await prisma.paymentRequest.update({
      where: { id: invoice.paymentRequestId },
      data: { status: "paid" },
    });
  }

  revalidatePath(`/admin/clients/${studentId}`);
}

// ────────────────────────────────────────────────────────────
// Invoices — Void
// ────────────────────────────────────────────────────────────

export async function voidInvoiceAction(invoiceId: string, studentId: string) {
  await requireRole("super_admin");

  await prisma.invoice.update({
    where: { id: invoiceId },
    data: { status: "cancelled" },
  });

  // Unlink any bookings from this invoice so they can be re-invoiced
  await prisma.booking.updateMany({
    where: { invoiceId },
    data: { invoiceId: null, paymentRequestId: null },
  });

  revalidatePath(`/admin/clients/${studentId}`);
}

// ────────────────────────────────────────────────────────────
// Invoices — Resend
// ────────────────────────────────────────────────────────────

export async function resendInvoiceAction(invoiceId: string) {
  await requireRole("super_admin");

  // Regenerate PDF and send
  await generateAndStoreInvoicePDF(invoiceId);
  await sendInvoiceEmail(invoiceId);
}

// ────────────────────────────────────────────────────────────
// Payment Requests — Regenerate payment link
// ────────────────────────────────────────────────────────────

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://life-therapy.co.za";

export async function regeneratePaymentLinkAction(
  paymentRequestId: string,
  studentId: string,
) {
  await requireRole("super_admin");

  const pr = await prisma.paymentRequest.findUnique({
    where: { id: paymentRequestId },
  });
  if (!pr) throw new Error("Payment request not found");
  if (pr.status !== "pending" && pr.status !== "overdue") {
    throw new Error(`Cannot regenerate link for a ${pr.status} payment request`);
  }

  // Resolve email — handle both student and corporate billing entity
  let email: string;
  if (pr.billingEntityId) {
    const entity = await prisma.billingEntity.findUnique({
      where: { id: pr.billingEntityId },
    });
    email = entity?.email || "";
  } else {
    const student = await prisma.student.findUnique({
      where: { id: pr.studentId! },
      select: { email: true, billingEmail: true },
    });
    email = student?.billingEmail || student?.email || "";
  }

  if (!email) throw new Error("No billing email found");

  const reference = `pr-${pr.id.slice(-8)}-${Date.now()}`;
  const result = await initializeTransaction({
    email,
    amount: pr.totalCents,
    currency: pr.currency || "ZAR",
    reference,
    callback_url: `${APP_URL}/portal/invoices`,
    metadata: { paymentRequestId: pr.id },
  });

  await prisma.paymentRequest.update({
    where: { id: pr.id },
    data: {
      paymentUrl: result.authorization_url,
      paystackReference: reference,
    },
  });

  revalidatePath(`/admin/clients/${studentId}`);
  return { paymentUrl: result.authorization_url };
}

// ────────────────────────────────────────────────────────────
// Billing — Ad-hoc payment request helper
// ────────────────────────────────────────────────────────────

async function createAdhocPaymentRequest(opts: {
  contact: BillingContact;
  bookings: Booking[];
  student: Student;
  settings: Awaited<ReturnType<typeof getSiteSettings>>;
  billingMonth: string;
  periodStart: Date;
  periodEnd: Date;
  dueDate: Date;
  suffix: string;
}) {
  const { contact, bookings, student, settings, billingMonth, periodStart, periodEnd, dueDate, suffix } = opts;
  const lineItems: InvoiceLineItem[] = [];
  for (const booking of bookings) {
    const rate = await getSessionRate(
      booking.sessionType as "individual" | "couples" | "free_consultation",
      "ZAR",
    );
    const dateStr = format(new Date(booking.date), "d MMM yyyy");
    const subLine = `${dateStr}, ${booking.startTime}–${booking.endTime}`;

    let discountCents = 0;
    let discountPercent = 0;
    if (student.standingDiscountPercent && student.standingDiscountPercent > 0) {
      discountPercent = student.standingDiscountPercent;
      discountCents = Math.round((rate * discountPercent) / 100);
    }
    if (student.standingDiscountFixed && student.standingDiscountFixed > discountCents) {
      discountCents = student.standingDiscountFixed;
      discountPercent = 0;
    }

    lineItems.push({
      description: booking.sessionType === "couples" ? "Couples Session" : "Individual Session",
      subLine,
      quantity: 1,
      unitPriceCents: rate,
      discountCents,
      discountPercent,
      totalCents: Math.max(0, rate - discountCents),
      bookingId: booking.id,
      attendeeName: `${student.firstName} ${student.lastName}`,
    });
  }

  const isVat = settings.vatRegistered;
  const vatPercent = isVat ? settings.vatPercent : 0;
  const lineCalcs = lineItems.map((li) => ({
    unitPriceCents: li.unitPriceCents,
    quantity: li.quantity,
    lineDiscountPercent: li.discountPercent || undefined,
    lineDiscountCents: li.discountCents || undefined,
  }));
  const totals = calculateInvoiceTotals(lineCalcs, undefined, undefined, isVat, vatPercent);

  const pr = await prisma.paymentRequest.create({
    data: {
      studentId: contact.type === "corporate" ? undefined : contact.studentId,
      billingEntityId: contact.billingEntityId,
      billingMonth: `${billingMonth}-${suffix}`,
      periodStart,
      periodEnd,
      currency: "ZAR",
      subtotalCents: totals.subtotalCents,
      discountCents: totals.discountCents,
      vatAmountCents: totals.vatAmountCents,
      totalCents: totals.totalCents,
      lineItems: lineItems as unknown as Parameters<typeof prisma.paymentRequest.create>[0]["data"]["lineItems"],
      dueDate,
      status: "pending",
    },
  });

  const bookingIds = lineItems.map((li) => li.bookingId).filter((id): id is string => !!id);
  if (bookingIds.length > 0) {
    await prisma.booking.updateMany({
      where: { id: { in: bookingIds } },
      data: { paymentRequestId: pr.id },
    });
  }

  return pr;
}

// ────────────────────────────────────────────────────────────
// Billing — Bill to date (generate payment request for unbilled sessions)
// ────────────────────────────────────────────────────────────

export async function billToDateAction(studentId: string) {
  await requireRole("super_admin");

  const student = await prisma.student.findUniqueOrThrow({
    where: { id: studentId },
  });

  if (student.billingType !== "postpaid") {
    throw new Error("Bill to date is only available for postpaid clients");
  }

  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const { start: periodStart } = getBillingPeriod(year, month);

  const bookings = await getUnbilledBookings(studentId, periodStart, now);
  if (bookings.length === 0) {
    throw new Error("No unbilled sessions found for the current period");
  }

  // Partition bookings by session type
  const indivBookings = bookings.filter((b) => b.sessionType !== "couples");
  const couplesBookings = bookings.filter((b) => b.sessionType === "couples");

  const indivContact = indivBookings.length > 0
    ? await resolveBillingContact(studentId, "individual")
    : null;
  const couplesContact = couplesBookings.length > 0
    ? await resolveBillingContact(studentId, "couples")
    : null;

  // Determine if we need one or two payment requests
  const sameContact = indivContact && couplesContact
    && ((indivContact.billingEntityId && indivContact.billingEntityId === couplesContact.billingEntityId)
      || (!indivContact.billingEntityId && !couplesContact.billingEntityId && indivContact.studentId === couplesContact.studentId));

  const settings = await getSiteSettings();
  const billingMonth = `${year}-${String(month).padStart(2, "0")}`;
  const dueDate = new Date();
  dueDate.setDate(dueDate.getDate() + 7);

  const created = [];

  const base = { student, settings, billingMonth, periodStart, periodEnd: now, dueDate };

  if (sameContact && indivContact) {
    const pr = await createAdhocPaymentRequest({ ...base, contact: indivContact, bookings, suffix: "adhoc" });
    created.push(pr);
  } else {
    if (indivContact && indivBookings.length > 0) {
      const pr = await createAdhocPaymentRequest({ ...base, contact: indivContact, bookings: indivBookings, suffix: "adhoc-individual" });
      created.push(pr);
    }
    if (couplesContact && couplesBookings.length > 0) {
      const pr = await createAdhocPaymentRequest({ ...base, contact: couplesContact, bookings: couplesBookings, suffix: "adhoc-couples" });
      created.push(pr);
    }
  }

  revalidatePath(`/admin/clients/${studentId}`);
  return created[0]; // Return first for backward compat
}

// ────────────────────────────────────────────────────────────
// Update client email — syncs Prisma + Supabase Auth
// ────────────────────────────────────────────────────────────

export async function updateClientEmailAction(
  studentId: string,
  newEmail: string,
): Promise<{ success: true } | { success: false; error: string }> {
  await requireRole("super_admin");

  const email = newEmail.trim().toLowerCase();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { success: false, error: "Invalid email address." };
  }

  // Check for conflicts in students table
  const existing = await prisma.student.findFirst({
    where: { email, NOT: { id: studentId } },
    select: { id: true },
  });
  if (existing) {
    return { success: false, error: "That email is already used by another client." };
  }

  // Get current student (need supabaseUserId)
  const student = await prisma.student.findUnique({
    where: { id: studentId },
    select: { supabaseUserId: true, email: true },
  });
  if (!student) return { success: false, error: "Client not found." };

  // Check for conflicts in Supabase Auth
  const { data: authList } = await supabaseAdmin.auth.admin.listUsers();
  const conflict = authList?.users?.find(
    (u) => u.email === email && u.id !== student.supabaseUserId,
  );
  if (conflict) {
    return { success: false, error: "That email already has a portal account." };
  }

  // Update Supabase Auth (sends confirmation email to new address)
  if (student.supabaseUserId) {
    const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(
      student.supabaseUserId,
      { email, email_confirm: false },
    );
    if (authError) {
      return { success: false, error: `Auth update failed: ${authError.message}` };
    }
  }

  // Update Prisma
  await prisma.student.update({
    where: { id: studentId },
    data: { email },
  });

  revalidatePath(`/admin/clients/${studentId}`);
  return { success: true };
}

// ────────────────────────────────────────────────────────────
// Payment Requests — Void (cancel + unlink bookings)
// ────────────────────────────────────────────────────────────

export async function voidPaymentRequestAction(paymentRequestId: string, studentId: string) {
  await requireRole("super_admin");

  await prisma.paymentRequest.update({
    where: { id: paymentRequestId },
    data: { status: "cancelled" },
  });

  // Unlink bookings so they become unbilled again
  await prisma.booking.updateMany({
    where: { paymentRequestId },
    data: { paymentRequestId: null },
  });

  revalidatePath(`/admin/clients/${studentId}`);
}

// ────────────────────────────────────────────────────────────
// Payment Requests — Mark as paid (creates invoice)
// ────────────────────────────────────────────────────────────

export async function markPaymentRequestPaidAction(
  paymentRequestId: string,
  method: string,
  reference: string | undefined,
  studentId: string,
) {
  await requireRole("super_admin");

  const { createInvoiceFromPaymentRequest } = await import("@/lib/create-invoice");

  await createInvoiceFromPaymentRequest(paymentRequestId, {
    reference: reference || `manual-${Date.now()}`,
    method: method as "eft" | "cash" | "card",
    amountCents: 0, // Will be set from the PR's totalCents
  });

  revalidatePath(`/admin/clients/${studentId}`);
}

// ────────────────────────────────────────────────────────────
// Ad-hoc invoice creation
// ────────────────────────────────────────────────────────────

export async function generateAdHocInvoiceAction(params: {
  studentId: string;
  lineItems: InvoiceLineItem[];
  paymentMethod: "eft" | "cash" | "card";
  reference?: string;
  type?: string;
}) {
  await requireRole("super_admin");

  const { createManualInvoice } = await import("@/lib/create-invoice");

  const invoice = await createManualInvoice({
    type: params.type || "ad_hoc_session",
    studentId: params.studentId,
    lineItems: params.lineItems,
    paymentMethod: params.paymentMethod,
    paymentReference: params.reference,
  });

  await generateAndStoreInvoicePDF(invoice.id).catch((err) =>
    console.error("Failed to generate ad-hoc invoice PDF:", err),
  );

  await sendInvoiceEmail(invoice.id).catch((err) =>
    console.error("Failed to send ad-hoc invoice email:", err),
  );

  revalidatePath(`/admin/clients/${params.studentId}`);
  return { invoiceId: invoice.id };
}

// ────────────────────────────────────────────────────────────
// Get session rates for ad-hoc invoice dialog
// ────────────────────────────────────────────────────────────

export async function getSessionRatesAction() {
  await requireRole("super_admin", "editor");

  const individualRate = await getSessionRate("individual", "ZAR");
  const couplesRate = await getSessionRate("couples", "ZAR");

  return { individualRate, couplesRate };
}

// ────────────────────────────────────────────────────────────
// Create manual payment request
// ────────────────────────────────────────────────────────────

export async function createManualPaymentRequestAction(data: {
  studentId: string;
  lineItems: {
    description: string;
    subLine?: string;
    quantity: number;
    unitPriceCents: number;
  }[];
  discountPercent?: number;
  discountFixedCents?: number;
  dueDate: string;
  billingMonth?: string;
  note?: string;
  sendImmediately: boolean;
}): Promise<{ success: boolean; paymentRequestId?: string; error?: string }> {
  await requireRole("super_admin", "editor");

  try {
    const settings = await getSiteSettings();

    const lineItemsCalc = data.lineItems.map((li) => ({
      unitPriceCents: li.unitPriceCents,
      quantity: li.quantity,
      discountCents: 0,
      discountPercent: 0,
    }));

    const totals = calculateInvoiceTotals(
      lineItemsCalc,
      data.discountPercent,
      data.discountFixedCents,
      settings.vatRegistered ?? false,
      settings.vatPercent ?? 15,
    );

    const now = new Date();
    const billingMonth = data.billingMonth?.trim()
      || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

    const [ymYear, ymMonth] = billingMonth.split("-").map(Number);
    const periodStart = new Date(ymYear, ymMonth - 1, 1);
    const periodEnd = new Date(ymYear, ymMonth, 0); // last day of month

    const lineItemsJson: InvoiceLineItem[] = data.lineItems.map((li) => ({
      description: li.description,
      subLine: li.subLine,
      quantity: li.quantity,
      unitPriceCents: li.unitPriceCents,
      discountCents: 0,
      discountPercent: 0,
      totalCents: Math.round(li.unitPriceCents * li.quantity),
    }));

    const pr = await prisma.paymentRequest.create({
      data: {
        studentId: data.studentId,
        billingMonth,
        periodStart,
        periodEnd,
        currency: "ZAR",
        subtotalCents: totals.subtotalCents,
        discountCents: totals.discountCents,
        vatAmountCents: totals.vatAmountCents,
        totalCents: totals.totalCents,
        lineItems: lineItemsJson as unknown as Parameters<typeof prisma.paymentRequest.create>[0]["data"]["lineItems"],
        status: data.sendImmediately ? "pending" : "draft",
        dueDate: new Date(data.dueDate),
      },
    });

    if (data.sendImmediately) {
      // Generate Paystack link
      const student = await prisma.student.findUnique({
        where: { id: data.studentId },
        select: { email: true, billingEmail: true },
      });
      const email = student?.billingEmail || student?.email || "";

      if (email) {
        try {
          const reference = `pr-${pr.id.slice(-8)}-${Date.now()}`;
          const result = await initializeTransaction({
            email,
            amount: pr.totalCents,
            currency: pr.currency || "ZAR",
            reference,
            callback_url: `${process.env.NEXT_PUBLIC_APP_URL || "https://life-therapy.co.za"}/portal/invoices`,
            metadata: { paymentRequestId: pr.id },
          });
          await prisma.paymentRequest.update({
            where: { id: pr.id },
            data: { paymentUrl: result.authorization_url, paystackReference: reference },
          });
        } catch (err) {
          console.error("Paystack link generation failed:", err);
        }
      }

      // Send email with pro-forma PDF
      const { sendPaymentRequestEmail } = await import("@/lib/send-invoice");
      await sendPaymentRequestEmail(pr.id);
    }

    revalidatePath(`/admin/clients/${data.studentId}`);
    return { success: true, paymentRequestId: pr.id };
  } catch (err) {
    console.error("createManualPaymentRequestAction error:", err);
    return { success: false, error: err instanceof Error ? err.message : "Failed to create payment request" };
  }
}

// ────────────────────────────────────────────────────────────
// Get payment request details (for edit dialog)
// ────────────────────────────────────────────────────────────

export interface PaymentRequestDetails {
  id: string;
  studentId: string | null;
  lineItems: {
    description: string;
    subLine?: string;
    quantity: number;
    unitPriceCents: number;
    totalCents: number;
  }[];
  subtotalCents: number;
  discountCents: number;
  vatAmountCents: number;
  totalCents: number;
  dueDate: string | null;
  billingMonth: string;
  status: string;
  paymentUrl: string | null;
  proformaPdfUrl: string | null;
}

export async function getPaymentRequestDetailsAction(
  paymentRequestId: string,
): Promise<PaymentRequestDetails | null> {
  await requireRole("super_admin", "editor");

  const pr = await prisma.paymentRequest.findUnique({
    where: { id: paymentRequestId },
    select: {
      id: true,
      studentId: true,
      lineItems: true,
      subtotalCents: true,
      discountCents: true,
      vatAmountCents: true,
      totalCents: true,
      dueDate: true,
      billingMonth: true,
      status: true,
      paymentUrl: true,
      proformaPdfUrl: true,
    },
  });

  if (!pr) return null;

  const lineItems = (pr.lineItems as unknown as InvoiceLineItem[]).map((li) => ({
    description: li.description,
    subLine: li.subLine,
    quantity: li.quantity,
    unitPriceCents: li.unitPriceCents,
    totalCents: li.totalCents,
  }));

  return {
    id: pr.id,
    studentId: pr.studentId,
    lineItems,
    subtotalCents: pr.subtotalCents,
    discountCents: pr.discountCents,
    vatAmountCents: pr.vatAmountCents,
    totalCents: pr.totalCents,
    dueDate: pr.dueDate ? pr.dueDate.toISOString() : null,
    billingMonth: pr.billingMonth,
    status: pr.status,
    paymentUrl: pr.paymentUrl,
    proformaPdfUrl: pr.proformaPdfUrl,
  };
}

// ────────────────────────────────────────────────────────────
// Update payment request (edit dialog save)
// ────────────────────────────────────────────────────────────

export async function updatePaymentRequestAction(data: {
  paymentRequestId: string;
  studentId: string;
  lineItems: { description: string; subLine?: string; quantity: number; unitPriceCents: number }[];
  discountPercent?: number;
  discountFixedCents?: number;
  dueDate: string;
  resend: boolean;
}): Promise<{ success: boolean; error?: string }> {
  await requireRole("super_admin", "editor");

  try {
    const pr = await prisma.paymentRequest.findUniqueOrThrow({
      where: { id: data.paymentRequestId },
      select: { status: true, totalCents: true, paymentUrl: true, studentId: true, currency: true },
    });

    if (!["draft", "pending", "overdue"].includes(pr.status)) {
      return { success: false, error: "This payment request can no longer be edited" };
    }

    const settings = await getSiteSettings();
    const lineItemsCalc = data.lineItems.map((li) => ({
      unitPriceCents: li.unitPriceCents,
      quantity: li.quantity,
      discountCents: 0,
      discountPercent: 0,
    }));

    const totals = calculateInvoiceTotals(
      lineItemsCalc,
      data.discountPercent,
      data.discountFixedCents,
      settings.vatRegistered ?? false,
      settings.vatPercent ?? 15,
    );

    const lineItemsJson: InvoiceLineItem[] = data.lineItems.map((li) => ({
      description: li.description,
      subLine: li.subLine,
      quantity: li.quantity,
      unitPriceCents: li.unitPriceCents,
      discountCents: 0,
      discountPercent: 0,
      totalCents: Math.round(li.unitPriceCents * li.quantity),
    }));

    const amountChanged = totals.totalCents !== pr.totalCents;

    await prisma.paymentRequest.update({
      where: { id: data.paymentRequestId },
      data: {
        lineItems: lineItemsJson as unknown as Parameters<typeof prisma.paymentRequest.update>[0]["data"]["lineItems"],
        subtotalCents: totals.subtotalCents,
        discountCents: totals.discountCents,
        vatAmountCents: totals.vatAmountCents,
        totalCents: totals.totalCents,
        dueDate: new Date(data.dueDate),
      },
    });

    // Regenerate Paystack link if amount changed and URL exists
    if (amountChanged && pr.paymentUrl) {
      const studentId = pr.studentId || data.studentId;
      const student = await prisma.student.findUnique({
        where: { id: studentId },
        select: { email: true, billingEmail: true },
      });
      const email = student?.billingEmail || student?.email || "";
      if (email) {
        try {
          const reference = `pr-${data.paymentRequestId.slice(-8)}-${Date.now()}`;
          const result = await initializeTransaction({
            email,
            amount: totals.totalCents,
            currency: pr.currency || "ZAR",
            reference,
            callback_url: `${process.env.NEXT_PUBLIC_APP_URL || "https://life-therapy.co.za"}/portal/invoices`,
            metadata: { paymentRequestId: data.paymentRequestId },
          });
          await prisma.paymentRequest.update({
            where: { id: data.paymentRequestId },
            data: { paymentUrl: result.authorization_url, paystackReference: reference },
          });
        } catch (err) {
          console.error("Paystack regeneration failed:", err);
        }
      }
    }

    // Regenerate pro-forma PDF
    try {
      const { generateAndStoreProformaPDF } = await import("@/lib/generate-invoice-pdf");
      await generateAndStoreProformaPDF(data.paymentRequestId);
    } catch (err) {
      console.error("Pro-forma PDF regeneration failed:", err);
    }

    if (data.resend) {
      const { sendPaymentRequestEmail } = await import("@/lib/send-invoice");
      if (pr.status === "draft") {
        await prisma.paymentRequest.update({
          where: { id: data.paymentRequestId },
          data: { status: "pending" },
        });
      }
      await sendPaymentRequestEmail(data.paymentRequestId);
    }

    revalidatePath(`/admin/clients/${data.studentId}`);
    revalidatePath("/admin/invoices");
    return { success: true };
  } catch (err) {
    console.error("updatePaymentRequestAction error:", err);
    return { success: false, error: err instanceof Error ? err.message : "Failed to update payment request" };
  }
}

// ────────────────────────────────────────────────────────────
// Resend payment request (draft → pending, then send)
// ────────────────────────────────────────────────────────────

export async function resendPaymentRequestAction(
  paymentRequestId: string,
  studentId: string,
): Promise<{ success: boolean; error?: string }> {
  await requireRole("super_admin", "editor");

  const pr = await prisma.paymentRequest.findUnique({
    where: { id: paymentRequestId },
    select: { status: true, totalCents: true, paymentUrl: true, studentId: true, currency: true },
  });

  if (!pr) return { success: false, error: "Payment request not found" };
  if (pr.status === "paid" || pr.status === "cancelled") {
    return { success: false, error: "Cannot resend a paid or voided request" };
  }

  // Generate Paystack link if missing (e.g. draft with no URL)
  if (!pr.paymentUrl) {
    const sid = pr.studentId || studentId;
    const student = await prisma.student.findUnique({
      where: { id: sid },
      select: { email: true, billingEmail: true },
    });
    const email = student?.billingEmail || student?.email || "";
    if (email) {
      try {
        const reference = `pr-${paymentRequestId.slice(-8)}-${Date.now()}`;
        const result = await initializeTransaction({
          email,
          amount: pr.totalCents,
          currency: pr.currency || "ZAR",
          reference,
          callback_url: `${process.env.NEXT_PUBLIC_APP_URL || "https://life-therapy.co.za"}/portal/invoices`,
          metadata: { paymentRequestId },
        });
        await prisma.paymentRequest.update({
          where: { id: paymentRequestId },
          data: { paymentUrl: result.authorization_url, paystackReference: reference },
        });
      } catch (err) {
        console.error("Paystack link generation failed:", err);
      }
    }
  }

  if (pr.status === "draft") {
    await prisma.paymentRequest.update({
      where: { id: paymentRequestId },
      data: { status: "pending" },
    });
  }

  const { sendPaymentRequestEmail } = await import("@/lib/send-invoice");
  await sendPaymentRequestEmail(paymentRequestId);

  revalidatePath(`/admin/clients/${studentId}`);
  revalidatePath("/admin/invoices");
  return { success: true };
}
