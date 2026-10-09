export const dynamic = "force-dynamic";

import Link from "next/link";
import { requireAccess } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/lib/generated/prisma/client";
import { PageHeader } from "@/components/admin/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { addSaDays, isSaDateStr, saDayStart, saFormat, saToday } from "@/lib/dates";
import { isReadAction, toFeedRow } from "@/lib/admin/audit-feed";

const PAGE_SIZE = 50;

type Filters = { action?: string; actor?: string; entity?: string; from?: string; to?: string; page?: string };

function entityHref(entityType: string, entityId: string): string | null {
  if (entityType === "student") return `/admin/clients/${entityId}`;
  if (entityType === "booking") return `/admin/bookings/${entityId}`;
  return null;
}

/**
 * Every row of audit_logs, filterable — who changed, viewed or exported what. The table is
 * append-only in the database (prisma/sql/80_ops.sql), so this page reads; it never offers to
 * edit or remove. A failed audit write leaves a cron_runs "audit-write" row instead, counted in
 * the banner so a gap in the trail is visible where the trail is read.
 */
export default async function AuditLogPage({ searchParams }: Readonly<{ searchParams: Promise<Filters> }>) {
  await requireAccess("/admin/settings");
  const f = await searchParams;
  const page = Math.max(1, Number.parseInt(f.page ?? "1", 10) || 1);

  const where: Prisma.AuditLogWhereInput = {};
  if (f.action?.trim()) where.action = { contains: f.action.trim(), mode: "insensitive" };
  if (f.actor?.trim()) where.actorEmail = { contains: f.actor.trim(), mode: "insensitive" };
  if (f.entity?.trim()) where.entityId = f.entity.trim();
  const createdAt: Prisma.DateTimeFilter = {};
  if (isSaDateStr(f.from)) createdAt.gte = saDayStart(f.from);
  if (isSaDateStr(f.to)) createdAt.lt = saDayStart(addSaDays(f.to, 1));
  if (createdAt.gte || createdAt.lt) where.createdAt = createdAt;

  const thirtyDaysAgo = saDayStart(addSaDays(saToday(), -30));
  const [rows, total, gaps] = await Promise.all([
    prisma.auditLog.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * PAGE_SIZE, take: PAGE_SIZE }),
    prisma.auditLog.count({ where }),
    prisma.cronRun.count({ where: { jobName: "audit-write", status: "failed", startedAt: { gte: thirtyDaysAgo } } }),
  ]);
  const feed = rows.map(toFeedRow);
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const pageHref = (p: number) => {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(f)) if (v && k !== "page") params.set(k, v);
    params.set("page", String(p));
    return `/admin/settings/audit-log?${params.toString()}`;
  };

  return (
    <>
      <PageHeader
        sticky
        back={{ href: "/admin/settings", to: "Settings" }}
        title="Audit Log"
        description="Who changed, viewed or exported client and business data. Entries cannot be edited or deleted."
      />

      <div className="space-y-4">
        {gaps > 0 && (
          <Card className="border-destructive">
            <CardContent className="py-3 text-sm text-destructive">
              {gaps} audit {gaps === 1 ? "entry" : "entries"} failed to record in the last 30 days. The daily digest lists each one.
            </CardContent>
          </Card>
        )}

        <form method="get" className="grid gap-2 sm:grid-cols-6">
          <Input name="action" placeholder="Action contains…" defaultValue={f.action ?? ""} />
          <Input name="actor" placeholder="Admin email contains…" defaultValue={f.actor ?? ""} />
          <Input name="entity" placeholder="Record id" defaultValue={f.entity ?? ""} />
          <Input name="from" type="date" defaultValue={f.from ?? ""} aria-label="From" />
          <Input name="to" type="date" defaultValue={f.to ?? ""} aria-label="To" />
          <div className="flex gap-2">
            <Button type="submit" className="flex-1">Filter</Button>
            <Button asChild variant="outline">
              <Link href="/admin/settings/audit-log">Clear</Link>
            </Button>
          </div>
        </form>

        <p className="text-xs text-muted-foreground">
          {total} {total === 1 ? "entry" : "entries"} · page {page} of {pages}
        </p>

        <Card>
          <CardContent className="divide-y p-0">
            {feed.length === 0 && <p className="py-8 text-center text-sm text-muted-foreground">No entries match.</p>}
            {feed.map((row) => {
              const href = entityHref(row.entityType, row.entityId);
              return (
                <div key={row.id} className="flex flex-col gap-1 px-4 py-3 sm:flex-row sm:gap-4">
                  <div className="w-36 shrink-0 text-xs text-muted-foreground">
                    {saFormat(new Date(row.createdAt), "d MMM yyyy, HH:mm")}
                  </div>
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-medium">{row.label}</span>
                      <Badge variant={isReadAction(row.action) ? "outline" : "secondary"} className="text-[10px]">
                        {row.entityType}
                      </Badge>
                      {href ? (
                        <Link href={href} className="font-mono text-[11px] text-muted-foreground underline">
                          {row.entityId}
                        </Link>
                      ) : (
                        <span className="font-mono text-[11px] text-muted-foreground">{row.entityId}</span>
                      )}
                    </div>
                    {row.changes.length > 0 && (
                      <ul className="space-y-0.5 text-xs text-muted-foreground">
                        {row.changes.map((c) => (
                          <li key={c} className="break-words">{c}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                  <div className="shrink-0 text-xs text-muted-foreground sm:text-right">{row.actorEmail}</div>
                </div>
              );
            })}
          </CardContent>
        </Card>

        {pages > 1 && (
          <div className="flex justify-between">
            {page > 1 ? (
              <Button asChild variant="outline" size="sm"><Link href={pageHref(page - 1)}>Newer</Link></Button>
            ) : <span />}
            {page < pages ? (
              <Button asChild variant="outline" size="sm"><Link href={pageHref(page + 1)}>Older</Link></Button>
            ) : <span />}
          </div>
        )}
      </div>
    </>
  );
}
