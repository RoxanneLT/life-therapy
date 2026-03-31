export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import Link from "next/link";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Users, Upload } from "lucide-react";
import { ClientListFilters } from "./client-list-filters";
import { SortableHeader } from "@/components/admin/sortable-header";
import { CreateClientDialog } from "./create-client-dialog";

import { CLIENT_STATUS_BADGE } from "@/lib/status-styles";

const STATUS_TABS = ["all", "active", "at_risk", "potential", "inactive", "archived"] as const;

const ONBOARDING_LABELS: Record<number, string> = {
  0: "Not started",
  1: "Details done",
  2: "Assessment done",
  3: "Complete",
};

type SortField = "name" | "email" | "status" | "credits" | "sessions" | "onboarding" | "created";
type SortDir = "asc" | "desc";

const VALID_SORT_FIELDS: SortField[] = [
  "name", "email", "status", "credits", "sessions", "onboarding", "created",
];

function getOrderBy(sort: SortField, dir: SortDir) {
  switch (sort) {
    case "name":
      return [{ firstName: dir }, { lastName: dir }];
    case "email":
      return { email: dir };
    case "status":
      return { clientStatus: dir };
    case "credits":
      return { creditBalance: { balance: dir } };
    case "sessions":
      return { bookings: { _count: dir } };
    case "onboarding":
      return { onboardingStep: dir };
    case "created":
    default:
      return { createdAt: dir };
  }
}

export default async function ClientsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string; sort?: string; dir?: string }>;
}) {
  await requireRole("super_admin", "marketing");

  const { status, q, sort, dir } = await searchParams;
  const activeTab = STATUS_TABS.includes(status as (typeof STATUS_TABS)[number])
    ? (status as (typeof STATUS_TABS)[number])
    : "all";

  const sortField: SortField = VALID_SORT_FIELDS.includes(sort as SortField)
    ? (sort as SortField)
    : "created";
  const sortDir: SortDir = dir === "asc" ? "asc" : "desc";

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const where: Record<string, unknown> = {};
  if (activeTab === "at_risk") {
    // Active clients whose most recent completed session is 30+ days ago,
    // with no upcoming confirmed/pending bookings
    where.clientStatus = "active";
    where.bookings = { some: { status: "completed" } };
  } else if (activeTab !== "all") {
    where.clientStatus = activeTab;
  }
  if (q) {
    where.OR = [
      { firstName: { contains: q, mode: "insensitive" } },
      { lastName: { contains: q, mode: "insensitive" } },
      { email: { contains: q, mode: "insensitive" } },
      { phone: { contains: q, mode: "insensitive" } },
    ];
  }

  const [allClients, counts] = await Promise.all([
    prisma.student.findMany({
      where,
      take: 500,
      orderBy: getOrderBy(sortField, sortDir) as never,
      include: {
        _count: { select: { bookings: true, enrollments: true } },
        creditBalance: { select: { balance: true } },
        ...(activeTab === "at_risk"
          ? {
              bookings: {
                where: { status: { in: ["completed", "confirmed", "pending"] } },
                orderBy: { date: "desc" as const },
                take: 1,
                select: { date: true, status: true },
              },
            }
          : {}),
      },
    }),
    prisma.student.groupBy({
      by: ["clientStatus"],
      _count: true,
    }),
  ]);

  // For at_risk, filter in JS: last session must be completed & 30+ days ago
  let clients = allClients;
  if (activeTab === "at_risk") {
    clients = allClients.filter((c) => {
      const bookings = (c as Record<string, unknown>).bookings as
        | { date: Date; status: string }[]
        | undefined;
      if (!bookings?.length) return false;
      const last = bookings[0];
      // If they have a future confirmed/pending booking, not at risk
      if (last.status === "confirmed" || last.status === "pending") return false;
      return new Date(last.date) < thirtyDaysAgo;
    });
  }

  // Count at-risk clients (separate query for the badge count)
  const atRiskClients = activeTab === "at_risk"
    ? allClients.map((c) => ({
        id: c.id,
        bookings: ((c as Record<string, unknown>).bookings as { date: Date; status: string }[] | undefined) ?? [],
      }))
    : await prisma.student.findMany({
        where: {
          clientStatus: "active",
          bookings: { some: { status: "completed" } },
        },
        select: {
          id: true,
          bookings: {
            where: { status: { in: ["completed", "confirmed", "pending"] } },
            orderBy: { date: "desc" },
            take: 1,
            select: { date: true, status: true },
          },
        },
      });

  const atRiskCount = atRiskClients.filter((c) => {
    if (!c.bookings?.length) return false;
    const last = c.bookings[0];
    if (last.status === "confirmed" || last.status === "pending") return false;
    return new Date(last.date) < thirtyDaysAgo;
  }).length;

  const countMap: Record<string, number> = {};
  let totalCount = 0;
  for (const c of counts) {
    countMap[c.clientStatus] = c._count;
    totalCount += c._count;
  }
  countMap.at_risk = atRiskCount;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold">Clients</h1>
          <p className="text-sm text-muted-foreground">
            {totalCount} total clients
          </p>
        </div>
        <div className="flex gap-2">
          <CreateClientDialog />
          <Link href="/admin/clients/import">
            <Button variant="outline" size="sm">
              <Upload className="mr-2 h-4 w-4" />
              Import CSV
            </Button>
          </Link>
        </div>
      </div>

      <ClientListFilters
        activeTab={activeTab}
        search={q || ""}
        counts={{ all: totalCount, ...countMap }}
      />

      {clients.length === 0 ? (
        <div className="flex flex-col items-center py-16 text-center">
          <Users className="mb-4 h-12 w-12 text-muted-foreground" />
          <p className="text-muted-foreground">
            {q ? "No clients match your search." : "No clients found."}
          </p>
        </div>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>
                  <SortableHeader field="name" label="Name" currentSort={sortField} currentDir={sortDir} />
                </TableHead>
                <TableHead>
                  <SortableHeader field="email" label="Email" currentSort={sortField} currentDir={sortDir} />
                </TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>
                  <SortableHeader field="status" label="Status" currentSort={sortField} currentDir={sortDir} />
                </TableHead>
                <TableHead>
                  <SortableHeader field="credits" label="Credits" currentSort={sortField} currentDir={sortDir} className="justify-center" />
                </TableHead>
                <TableHead>
                  <SortableHeader field="sessions" label="Sessions" currentSort={sortField} currentDir={sortDir} className="justify-center" />
                </TableHead>
                <TableHead>
                  <SortableHeader field="onboarding" label="Onboarding" currentSort={sortField} currentDir={sortDir} />
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {clients.map((c) => (
                <TableRow key={c.id}>
                  <TableCell>
                    <Link
                      href={`/admin/clients/${c.id}`}
                      className="font-medium text-brand-600 hover:underline"
                    >
                      {c.firstName} {c.lastName}
                    </Link>
                  </TableCell>
                  <TableCell className="text-sm">{c.email}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {c.phone || "—"}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Badge
                        variant="secondary"
                        className={CLIENT_STATUS_BADGE[c.clientStatus] || ""}
                      >
                        {c.clientStatus}
                      </Badge>
                      {c.clientStatus === "potential" && (
                        <Link
                          href={`/admin/clients/${c.id}`}
                          className="text-xs font-medium text-brand-600 hover:underline"
                        >
                          Convert
                        </Link>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-center">
                    {c.creditBalance?.balance ?? 0}
                  </TableCell>
                  <TableCell className="text-center">
                    {c._count.bookings}
                  </TableCell>
                  <TableCell>
                    <span className="text-xs text-muted-foreground">
                      {ONBOARDING_LABELS[c.onboardingStep] || `Step ${c.onboardingStep}`}
                    </span>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
