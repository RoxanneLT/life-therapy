"use server";

import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { getClientInsights } from "@/lib/admin/client-insights";
import { toFeedRow, type AuditFeedRow } from "@/lib/admin/audit-feed";
import { canSeeClinical, withoutClinicalBookingFields } from "@/lib/clinical-access";

export async function fetchClientBookings(clientId: string) {
  const { adminUser } = await requireRole("super_admin", "marketing");
  const result = await prisma.student.findUnique({
    where: { id: clientId },
    select: {
      bookings: { orderBy: { date: "desc" }, take: 200 },
    },
  });
  const bookings = canSeeClinical(adminUser.role) ? (result?.bookings ?? []) : (result?.bookings ?? []).map(withoutClinicalBookingFields);
  return JSON.parse(JSON.stringify(bookings)) as unknown[];
}

export async function fetchClientFinances(clientId: string) {
  const { adminUser } = await requireRole("super_admin", "marketing");
  const result = await prisma.student.findUnique({
    where: { id: clientId },
    select: {
      billFullMonth: true,
      bookings: { orderBy: { date: "desc" }, take: 200 },
      creditTransactions: { orderBy: { createdAt: "desc" }, take: 50 },
      orders: {
        where: { status: "paid" },
        include: { items: true },
        orderBy: { createdAt: "desc" },
      },
      invoices: { orderBy: { createdAt: "desc" }, take: 50 },
      paymentRequests: { orderBy: { createdAt: "desc" }, take: 50 },
      digitalProductAccess: {
        include: { digitalProduct: { select: { title: true, slug: true } } },
      },
      enrollments: {
        include: { course: { select: { title: true, slug: true } } },
        orderBy: { enrolledAt: "desc" },
      },
      individualBilledTo: {
        include: {
          student: { select: { id: true, firstName: true, lastName: true } },
          relatedStudent: { select: { id: true, firstName: true, lastName: true } },
          billingEntity: { select: { id: true, name: true } },
        },
      },
      couplesBilledTo: {
        include: {
          student: { select: { id: true, firstName: true, lastName: true } },
          relatedStudent: { select: { id: true, firstName: true, lastName: true } },
          billingEntity: { select: { id: true, name: true } },
        },
      },
      relationshipsFrom: {
        include: {
          relatedStudent: {
            select: { id: true, firstName: true, lastName: true, email: true },
          },
          billingEntity: true,
        },
      },
      relationshipsTo: {
        include: {
          student: {
            select: { id: true, firstName: true, lastName: true, email: true },
          },
          billingEntity: true,
        },
      },
    },
  });

  const billedToMeRaw = await prisma.student.findMany({
    where: {
      id: { not: clientId },
      OR: [
        { individualBilledTo: { OR: [{ studentId: clientId }, { relatedStudentId: clientId }] } },
        { couplesBilledTo: { OR: [{ studentId: clientId }, { relatedStudentId: clientId }] } },
      ],
    },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      individualBilledTo: { select: { studentId: true, relatedStudentId: true } },
      couplesBilledTo: { select: { studentId: true, relatedStudentId: true } },
    },
  });

  const billedToMe = billedToMeRaw
    .map((s) => {
      const types: string[] = [];
      if (
        s.individualBilledTo &&
        (s.individualBilledTo.studentId === clientId ||
          s.individualBilledTo.relatedStudentId === clientId)
      ) {
        types.push("individual");
      }
      if (
        s.couplesBilledTo &&
        (s.couplesBilledTo.studentId === clientId ||
          s.couplesBilledTo.relatedStudentId === clientId)
      ) {
        types.push("couples");
      }
      return { id: s.id, name: `${s.firstName} ${s.lastName}`, types };
    })
    .filter((s) => s.types.length > 0);

  return JSON.parse(
    JSON.stringify({
      ...(result ?? {}),
      ...(result && !canSeeClinical(adminUser.role) ? { bookings: result.bookings.map(withoutClinicalBookingFields) } : {}),
      _billedToMe: billedToMe,
    }),
  ) as Record<string, unknown>;
}

export async function fetchClientRelationships(clientId: string) {
  await requireRole("super_admin", "marketing");
  const result = await prisma.student.findUnique({
    where: { id: clientId },
    select: {
      commitmentAcks: { orderBy: { acknowledgedAt: "desc" } },
      documentAcceptances: {
        orderBy: { acceptedAt: "desc" },
        include: { document: { select: { title: true } } },
      },
      relationshipsFrom: {
        include: {
          relatedStudent: {
            select: { id: true, firstName: true, lastName: true, email: true },
          },
          billingEntity: true,
        },
      },
      relationshipsTo: {
        include: {
          student: {
            select: { id: true, firstName: true, lastName: true, email: true },
          },
          billingEntity: true,
        },
      },
    },
  });
  return JSON.parse(JSON.stringify(result ?? {})) as Record<string, unknown>;
}

export async function fetchClientCommunications(clientId: string) {
  await requireRole("super_admin", "marketing");
  const result = await prisma.student.findUnique({
    where: { id: clientId },
    select: {
      dripProgress: true,
      campaignProgress: {
        include: { campaign: { select: { name: true } } },
        orderBy: { createdAt: "desc" },
        take: 10,
      },
      emailLogs: {
        orderBy: { sentAt: "desc" },
        take: 20,
        select: {
          id: true,
          subject: true,
          status: true,
          sentAt: true,
          openedAt: true,
          opensCount: true,
          clickedAt: true,
          clicksCount: true,
          templateKey: true,
        },
      },
    },
  });
  return JSON.parse(JSON.stringify(result ?? {})) as Record<string, unknown>;
}

export async function fetchClientInsights(clientId: string) {
  await requireRole("super_admin", "marketing");
  const insights = await getClientInsights(clientId);
  return JSON.parse(JSON.stringify(insights)) as Awaited<ReturnType<typeof getClientInsights>>;
}

/**
 * Everything the audit trail holds about one client: rows on the client itself, on their
 * bookings, payment requests and invoices, and bulk rows whose metadata.ids names them.
 * super_admin only — the feed includes who viewed the clinical record.
 */
export async function fetchClientActivity(clientId: string): Promise<AuditFeedRow[]> {
  await requireRole("super_admin");
  const [bookings, paymentRequests, invoices] = await Promise.all([
    prisma.booking.findMany({ where: { studentId: clientId }, select: { id: true, recurringSeriesId: true } }),
    prisma.paymentRequest.findMany({ where: { studentId: clientId }, select: { id: true } }),
    prisma.invoice.findMany({ where: { studentId: clientId }, select: { id: true } }),
  ]);
  const bookingIds = bookings.map((b) => b.id);
  // A series row is keyed by its recurringSeriesId, not by any one booking's id.
  const seriesIds = [...new Set(bookings.map((b) => b.recurringSeriesId).filter((s): s is string => !!s))];
  const rows = await prisma.auditLog.findMany({
    where: {
      OR: [
        { entityType: "student", entityId: clientId },
        { entityType: "booking", entityId: { in: [...bookingIds, ...seriesIds] } },
        { entityType: "payment_request", entityId: { in: paymentRequests.map((p) => p.id) } },
        { entityType: "invoice", entityId: { in: invoices.map((i) => i.id) } },
        { entityType: "bulk", entityId: `student:${clientId}` },
        // Bulk rows list what they touched in metadata.ids: client ids, or booking ids.
        ...[clientId, ...bookingIds].map((id) => ({ metadata: { path: ["ids"], array_contains: [id] } })),
      ],
    },
    orderBy: { createdAt: "desc" },
    take: 200,
  });
  return rows.map(toFeedRow);
}
