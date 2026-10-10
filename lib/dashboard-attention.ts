/**
 * The dashboard's "Needs attention" list: one typed roll-up that every area feeds, so a thing
 * waiting on a person is found in one place rather than in a banner, a strip and four cards.
 * (Shape borrowed from pleks's lib/dashboard/attentionItems.ts; the sources are this practice's.)
 *
 * Each item is gated by the page it links to, through lib/admin-access.ts. A row the reader cannot open is not
 * shown, so an editor never meets a link that `requireRole` bounces back to /admin.
 *
 * Failed email has its own row because nothing else surfaces it: the admin UI has a delivery log
 * for campaigns and none for transactional mail (CLAUDE.md §6, 2026-08-19, the partner invite).
 */
import { prisma } from "@/lib/prisma";
import { addSaDays, calendarDate, saDayStart, saFormat, saToday } from "@/lib/dates";
import type { AdminRole } from "@/lib/generated/prisma/client";
import { canAccess } from "@/lib/admin-access";

export interface AttentionEntry {
  label: string;
  detail?: string;
  href?: string;
}

export interface AttentionItem {
  key: string;
  /** 1 = act today, 2 = this week, 3 = when convenient */
  priority: 1 | 2 | 3;
  title: string;
  detail?: string;
  href?: string;
  count: number;
  /** Individual records behind the count, when the count alone does not say where to go. */
  entries?: AttentionEntry[];
  /** A one-click fix rendered beside the row. */
  action?: "mark-stale-completed";
  /** Sidebar entries whose count badge this row adds to (getNavBadges). */
  nav: string[];
}

const ENTRY_LIMIT = 3;

/**
 * The drift counts both reconcile routes write into a "partial" log's metadata. `protectedWrongDay`
 * is left out: it is a subset of `orphaned` (app/api/admin/reconcile-calendar), so adding it would
 * count those events twice.
 */
const DRIFT_KINDS: [string, string][] = [
  ["missing", "missing from the calendar"],
  ["mismatched", "mismatched"],
  ["orphaned", "calendar events with no booking"],
  ["duplicates", "duplicated"],
  ["onHoliday", "on a public holiday"],
];

const plural =(n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** Confirmed sessions on a day before today: the bookings list's "stale" filter and the bulk-complete action. */
function countStaleSessions(): Promise<number> {
  return prisma.booking.count({ where: { status: "confirmed", date: { lt: calendarDate(saToday()) } } });
}

/**
 * Payment requests due before today began and not settled. The status alone is not trusted to have
 * been moved to "overdue" by a cron, so a pending request past its date counts too.
 */
function countOverduePaymentRequests(): Promise<number> {
  return prisma.paymentRequest.count({
    where: { status: { in: ["pending", "overdue"] }, dueDate: { lt: saDayStart(saToday()) } },
  });
}

/**
 * Counts for the sidebar, keyed by nav href: the attention rows themselves, summed by the entries
 * each names in `nav`. Built from the rows rather than beside them, so a badge and the dashboard
 * row can never disagree, and a new row gets its badge by naming where it belongs. Gated like them.
 */
export async function getNavBadges(role: AdminRole): Promise<Record<string, number>> {
  const badges: Record<string, number> = {};
  for (const item of await getAttentionItems(role)) {
    for (const href of item.nav) badges[href] = (badges[href] ?? 0) + item.count;
  }
  return badges;
}

export async function getAttentionItems(role: AdminRole): Promise<AttentionItem[]> {
  const today = saToday();
  const todayStart = saDayStart(today);
  const can = (href: string) => canAccess(href, role);
  const none = Promise.resolve(null);

  const [stale, syncFailures, lastReconcile, overdue, failedEmails, expiring, conflicts] = await Promise.all([
    can("/admin/bookings") ? countStaleSessions() : none,
    can("/admin/settings/calendar-sync")
      ? prisma.calendarSyncLog.count({ where: { status: "failed", createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } } })
      : none,
    can("/admin/settings/calendar-sync")
      ? prisma.calendarSyncLog.findFirst({
          where: { operation: "reconcile" },
          orderBy: { createdAt: "desc" },
          select: { status: true, metadata: true },
        })
      : none,
    can("/admin/invoices") ? countOverduePaymentRequests() : none,
    // Links to client records, but failed mail is administered under Email Templates.
    can("/admin/email-templates")
      ? prisma.emailLog.findMany({
          where: { status: "failed", sentAt: { gte: saDayStart(addSaDays(today, -7)) } },
          orderBy: { sentAt: "desc" },
          select: { to: true, templateKey: true, subject: true, studentId: true, sentAt: true },
          take: 50,
        })
      : none,
    // Links to client records, but credit balances are billing data.
    can("/admin/invoices")
      ? prisma.sessionCreditBalance.findMany({
          where: { balance: { gt: 0 }, expiresAt: { gte: todayStart, lt: saDayStart(addSaDays(today, 15)) } },
          orderBy: { expiresAt: "asc" },
          select: { balance: true, expiresAt: true, student: { select: { id: true, firstName: true, lastName: true } } },
          take: 20,
        })
      : none,
    can("/admin/clients")
      ? prisma.auditLog.findMany({
          where: { action: "contact_field_conflict", entityType: "student", createdAt: { gte: saDayStart(addSaDays(today, -30)) } },
          orderBy: { createdAt: "desc" },
          select: { entityId: true },
          take: 50,
        })
      : none,
  ]);

  const items: AttentionItem[] = [];

  if (stale) {
    items.push({
      key: "stale-sessions",
      priority: 1,
      title: `${plural(stale, "past session")} still marked confirmed`,
      detail: "Mark them completed, or open each one to record a no-show or cancellation.",
      href: "/admin/bookings?status=stale",
      count: stale,
      action: "mark-stale-completed",
      nav: ["/admin/bookings"],
    });
  }

  if (syncFailures) {
    items.push({
      key: "calendar-sync-failed",
      priority: 1,
      title: `${plural(syncFailures, "calendar sync failure")} in the last 24 hours`,
      detail: "A booking may be missing from Outlook or Teams, or a cancelled one may still be there.",
      href: "/admin/settings/calendar-sync",
      count: syncFailures,
      nav: ["/admin/settings", "/admin/settings/calendar-sync"],
    });
  } else if (lastReconcile?.status === "partial") {
    // "partial" means ANY drift (both reconcile routes), not only mismatches: the dashboard used to
    // read `mismatched` alone and showed "0 mismatch(es)" for a run that found missing events.
    const m = (lastReconcile.metadata ?? {}) as Record<string, unknown>;
    const parts = DRIFT_KINDS.flatMap(([k, label]) => {
      const n = typeof m[k] === "number" ? m[k] : 0;
      return n > 0 ? [{ n, text: `${n} ${label}` }] : [];
    });
    const total = parts.reduce((s, p) => s + p.n, 0);
    items.push({
      key: "calendar-sync-drift",
      priority: 2,
      title: "Calendar out of step with bookings",
      detail: parts.length > 0 ? parts.map((p) => p.text).join(" · ") : "The last reconcile reported drift.",
      href: "/admin/settings/calendar-sync",
      count: total,
      nav: ["/admin/settings", "/admin/settings/calendar-sync"],
    });
  }

  if (overdue) {
    items.push({
      key: "payments-overdue",
      priority: 1,
      title: `${plural(overdue, "payment request")} past due`,
      // The "Requested" tab, which lists payment requests. `?status=overdue` filters the
      // INVOICE table, so it could never show the requests this row counts.
      href: "/admin/invoices?status=payment_requested",
      count: overdue,
      nav: ["/admin/invoices"],
    });
  }

  if (failedEmails && failedEmails.length > 0) {
    items.push({
      key: "email-failed",
      priority: 1,
      title: `${plural(failedEmails.length, "email")} failed to send this week`,
      detail: "The provider refused these. Usually a mistyped address: correct it, then resend from the record.",
      count: failedEmails.length,
      nav: ["/admin/email-templates"],
      entries: failedEmails.slice(0, ENTRY_LIMIT).map((e) => ({
        label: e.to,
        detail: `${e.templateKey ?? e.subject} · ${saFormat(e.sentAt, "d MMM, HH:mm")}`,
        href: e.studentId ? `/admin/clients/${e.studentId}` : undefined,
      })),
    });
  }

  if (expiring && expiring.length > 0) {
    items.push({
      key: "credits-expiring",
      priority: 2,
      title: `${plural(expiring.length, "client")} with session credits expiring within 14 days`,
      count: expiring.length,
      // Billing, not Clients: the row is gated by billing access, and Clients is a marketing page.
      nav: ["/admin/invoices"],
      entries: expiring.slice(0, ENTRY_LIMIT).map((c) => ({
        label: `${c.student.firstName} ${c.student.lastName}`,
        detail: `${plural(c.balance, "credit")} · expires ${saFormat(c.expiresAt!, "d MMM")}`,
        href: `/admin/clients/${c.student.id}`,
      })),
    });
  }

  if (conflicts && conflicts.length > 0) {
    const ids = [...new Set(conflicts.map((c) => c.entityId))];
    const students = await prisma.student.findMany({
      where: { id: { in: ids.slice(0, ENTRY_LIMIT) } },
      select: { id: true, firstName: true, lastName: true },
    });
    const byId = new Map(students.map((s) => [s.id, s]));
    items.push({
      key: "contact-conflicts",
      priority: 3,
      title: `${plural(ids.length, "client")} sent contact details that differ from their record`,
      detail: "Kept as stored. Check whether the new details are a real change.",
      count: ids.length,
      nav: ["/admin/clients"],
      entries: ids.slice(0, ENTRY_LIMIT).flatMap((id) => {
        const s = byId.get(id);
        return s ? [{ label: `${s.firstName} ${s.lastName}`, href: `/admin/clients/${id}` }] : [];
      }),
    });
  }

  return items.sort((a, b) => a.priority - b.priority);
}
