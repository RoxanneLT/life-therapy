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

const STATUS_TABS = ["all", "active", "potential", "inactive", "archived"] as const;

const STATUS_COLORS: Record<string, string> = {
  potential: "bg-blue-100 text-blue-700",
  active: "bg-green-100 text-green-700",
  inactive: "bg-gray-100 text-gray-600",
  archived: "bg-red-100 text-red-700",
};

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

  const where: Record<string, unknown> = {};
  if (activeTab !== "all") {
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

  const [clients, counts] = await Promise.all([
    prisma.student.findMany({
      where,
      orderBy: getOrderBy(sortField, sortDir) as never,
      include: {
        _count: { select: { bookings: true, enrollments: true } },
        creditBalance: { select: { balance: true } },
      },
    }),
    prisma.student.groupBy({
      by: ["clientStatus"],
      _count: true,
    }),
  ]);

  const countMap: Record<string, number> = {};
  let totalCount = 0;
  for (const c of counts) {
    countMap[c.clientStatus] = c._count;
    totalCount += c._count;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold">Clients</h1>
          <p className="text-sm text-muted-foreground">
            {totalCount} total clients
          </p>
        </div>
        <Link href="/admin/clients/import">
          <Button variant="outline" size="sm">
            <Upload className="mr-2 h-4 w-4" />
            Import CSV
          </Button>
        </Link>
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
                        className={STATUS_COLORS[c.clientStatus] || ""}
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
