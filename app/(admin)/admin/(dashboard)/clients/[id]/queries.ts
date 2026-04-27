"use server";

import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { getClientInsights } from "@/lib/admin/client-insights";

export async function fetchClientBookings(clientId: string) {
  await requireRole("super_admin", "marketing");
  const result = await prisma.student.findUnique({
    where: { id: clientId },
    select: {
      bookings: { orderBy: { date: "desc" }, take: 50 },
    },
  });
  return JSON.parse(JSON.stringify(result?.bookings ?? [])) as unknown[];
}

export async function fetchClientFinances(clientId: string) {
  await requireRole("super_admin", "marketing");
  const result = await prisma.student.findUnique({
    where: { id: clientId },
    select: {
      bookings: { orderBy: { date: "desc" }, take: 50 },
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
    JSON.stringify({ ...(result ?? {}), _billedToMe: billedToMe }),
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
