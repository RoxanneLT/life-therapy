"use server";

import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { revalidatePath } from "next/cache";

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
