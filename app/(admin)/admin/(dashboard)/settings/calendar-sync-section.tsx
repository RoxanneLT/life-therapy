"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  RefreshCw,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Copy,
  CalendarClock,
  CalendarX,
  ExternalLink,
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

interface SyncLogEntry {
  id: string;
  operation: string;
  status: string;
  graphEventId: string | null;
  errorMessage: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

interface MismatchDetail {
  bookingId: string;
  clientName: string;
  bookingDate: string;
  bookingTime: string;
  outlookDate: string;
  outlookTime: string;
  autoFixed: boolean;
}

interface MissingDetail {
  bookingId: string;
  clientName: string;
  date: string;
  time: string;
  reason: string;
  autoFixed: boolean;
}

interface OrphanDetail {
  graphEventId: string;
  subject: string;
  date: string;
}

interface HolidayDetail {
  bookingId: string;
  clientName: string;
  date: string;
  time: string;
  holiday: string;
}

interface ReconcileResult {
  checked: number;
  matched: number;
  mismatched: MismatchDetail[];
  missing: MissingDetail[];
  orphaned: OrphanDetail[];
  onHoliday: HolidayDetail[];
  fixed: number;
  errors: string[];
  scannedEvents?: number;
  sessionEventsScanned?: number;
}

interface CalendarSyncSectionProps {
  recentLogs: SyncLogEntry[];
  lastReconcileResult: Record<string, unknown> | null;
  lastReconcileAt: string | null;
}

interface DiagnosticsResponse {
  account: {
    configured: boolean;
    configuredEmail?: string;
    displayName?: string;
    mail?: string;
    error?: string;
    identityError?: string;
    upcomingEvents?: {
      subject: string;
      start: string;
      end: string;
      isOnlineMeeting: boolean;
      organizer?: string;
    }[];
  };
  range: { start: string; end: string };
  portal: {
    bookingId: string;
    date: string;
    start: string;
    end: string;
    clientName: string;
    status: string;
    synced: boolean;
  }[];
  portalCount: number;
  teamsCount: number;
}

const REASON_LABEL: Record<string, string> = {
  no_graph_id: "Never synced to Outlook",
  event_not_found: "Missing from Outlook",
  event_deleted: "Deleted from Outlook",
};

function reasonLabel(reason: string): string {
  return REASON_LABEL[reason] ?? reason;
}

/** Build a plain-text report for the copy button. */
function buildReport(r: ReconcileResult, mode: string, ranAt: Date): string {
  const lines: string[] = [];
  lines.push(`Calendar Reconciliation — ${format(ranAt, "d MMM yyyy, HH:mm")}`);
  lines.push(`Mode: ${mode}`);
  lines.push(
    `Checked ${r.checked} · Matched ${r.matched} · Auto-fixed ${r.fixed} · ` +
      `Mismatched ${r.mismatched.length} · Missing ${r.missing.length} · ` +
      `Stale ${r.orphaned.length} · Holiday ${r.onHoliday.length} · Errors ${r.errors.length}`,
  );

  if (r.mismatched.length) {
    lines.push("", `MISMATCHED (${r.mismatched.length}) — booking and Outlook disagree:`);
    for (const m of r.mismatched) {
      lines.push(
        `  • ${m.clientName}: booking ${m.bookingDate} ${m.bookingTime} vs Outlook ${m.outlookDate} ${m.outlookTime}`,
      );
    }
  }

  const unfixed = r.missing.filter((m) => !m.autoFixed);
  const fixed = r.missing.filter((m) => m.autoFixed);
  if (unfixed.length) {
    lines.push("", `MISSING — needs fixing (${unfixed.length}):`);
    for (const m of unfixed) {
      lines.push(`  • ${m.clientName} ${m.date} ${m.time} — ${reasonLabel(m.reason)}`);
    }
  }
  if (fixed.length) {
    lines.push("", `MISSING — auto-recreated (${fixed.length}):`);
    for (const m of fixed) {
      lines.push(`  • ${m.clientName} ${m.date} ${m.time}`);
    }
  }

  if (r.orphaned.length) {
    lines.push("", `STALE / WRONG EVENTS IN OUTLOOK (${r.orphaned.length}) — no matching booking, delete manually:`);
    for (const o of r.orphaned) lines.push(`  • ${o.subject} — ${o.date}`);
  }

  if (r.onHoliday.length) {
    lines.push("", `BOOKINGS ON PUBLIC HOLIDAYS (${r.onHoliday.length}):`);
    for (const h of r.onHoliday) lines.push(`  • ${h.clientName} ${h.date} ${h.time}`);
  }

  if (r.errors.length) {
    lines.push("", `ERRORS (${r.errors.length}):`);
    for (const e of r.errors) lines.push(`  • ${e}`);
  }

  if (!r.mismatched.length && !unfixed.length && !r.orphaned.length && !r.onHoliday.length && !r.errors.length) {
    lines.push("", "✓ No issues — every booking matches Outlook.");
  }
  return lines.join("\n");
}

function StatChip({
  label,
  value,
  tone,
}: Readonly<{
  label: string;
  value: number;
  tone: "neutral" | "good" | "warn" | "bad";
}>) {
  const toneClass =
    tone === "good"
      ? "border-green-200 bg-green-50 text-green-700"
      : tone === "warn"
        ? "border-amber-200 bg-amber-50 text-amber-700"
        : tone === "bad"
          ? "border-red-200 bg-red-50 text-red-700"
          : "border-border bg-muted/50 text-foreground";
  return (
    <div className={`rounded-md border px-3 py-2 ${toneClass}`}>
      <div className="text-lg font-semibold leading-none">{value}</div>
      <div className="mt-1 text-xs opacity-80">{label}</div>
    </div>
  );
}

function ReconcileReport({ result, mode, ranAt }: Readonly<{ result: ReconcileResult; mode: string; ranAt: Date }>) {
  const unfixedMissing = result.missing.filter((m) => !m.autoFixed);
  const fixedMissing = result.missing.filter((m) => m.autoFixed);
  const issueCount =
    result.mismatched.length +
    unfixedMissing.length +
    result.orphaned.length +
    result.onHoliday.length +
    result.errors.length;

  function handleCopy() {
    const text = buildReport(result, mode, ranAt);
    navigator.clipboard.writeText(text).then(
      () => toast.success("Report copied to clipboard"),
      () => toast.error("Could not copy — select and copy manually"),
    );
  }

  return (
    <div className="space-y-4 rounded-lg border p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-sm font-medium">
            {issueCount === 0 ? (
              <>
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                All bookings match Outlook
              </>
            ) : (
              <>
                <AlertTriangle className="h-4 w-4 text-amber-600" />
                {issueCount} item{issueCount === 1 ? "" : "s"} need attention
              </>
            )}
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {mode} · {format(ranAt, "d MMM yyyy, HH:mm")}
            {result.scannedEvents != null && (
              <>
                {" "}· reverse-scanned {result.scannedEvents} Outlook event
                {result.scannedEvents === 1 ? "" : "s"} ({result.sessionEventsScanned ?? 0} session)
              </>
            )}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={handleCopy}>
          <Copy className="mr-1.5 h-3.5 w-3.5" />
          Copy report
        </Button>
      </div>

      {/* Summary chips */}
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
        <StatChip label="Checked" value={result.checked} tone="neutral" />
        <StatChip label="Matched" value={result.matched} tone="good" />
        <StatChip label="Auto-fixed" value={result.fixed} tone={result.fixed > 0 ? "good" : "neutral"} />
        <StatChip label="Mismatched" value={result.mismatched.length} tone={result.mismatched.length ? "warn" : "neutral"} />
        <StatChip label="Missing" value={unfixedMissing.length} tone={unfixedMissing.length ? "bad" : "neutral"} />
        <StatChip label="Stale" value={result.orphaned.length} tone={result.orphaned.length ? "warn" : "neutral"} />
        <StatChip label="Holiday" value={result.onHoliday.length} tone={result.onHoliday.length ? "warn" : "neutral"} />
        <StatChip label="Errors" value={result.errors.length} tone={result.errors.length ? "bad" : "neutral"} />
      </div>

      {/* Mismatched */}
      {result.mismatched.length > 0 && (
        <div className="space-y-2">
          <h4 className="flex items-center gap-1.5 text-sm font-semibold text-amber-700">
            <CalendarClock className="h-4 w-4" /> Mismatched ({result.mismatched.length})
          </h4>
          <p className="text-xs text-muted-foreground">
            The booking and the Outlook event disagree on date/time. Open the booking and reschedule it
            (which rewrites the Outlook event), or fix the event directly in Outlook.
          </p>
          <ul className="space-y-1.5">
            {result.mismatched.map((m) => (
              <li
                key={m.bookingId}
                className="flex items-center justify-between gap-3 rounded-md border border-amber-200 bg-amber-50/50 px-3 py-2 text-sm"
              >
                <span>
                  <strong>{m.clientName}</strong> — booking{" "}
                  <span className="font-medium">{m.bookingDate} {m.bookingTime}</span>, Outlook{" "}
                  <span className="font-medium">{m.outlookDate} {m.outlookTime}</span>
                </span>
                <Link
                  href={`/admin/bookings/${m.bookingId}`}
                  className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-brand-700 hover:underline"
                >
                  Open <ExternalLink className="h-3 w-3" />
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Missing — needs fixing */}
      {unfixedMissing.length > 0 && (
        <div className="space-y-2">
          <h4 className="flex items-center gap-1.5 text-sm font-semibold text-red-700">
            <CalendarX className="h-4 w-4" /> Missing from Outlook ({unfixedMissing.length})
          </h4>
          <p className="text-xs text-muted-foreground">
            No Outlook event exists for these bookings. Run <strong>Check &amp; Auto-Fix</strong> to recreate them
            (clients are not re-invited).
          </p>
          <ul className="space-y-1.5">
            {unfixedMissing.map((m) => (
              <li
                key={m.bookingId}
                className="flex items-center justify-between gap-3 rounded-md border border-red-200 bg-red-50/50 px-3 py-2 text-sm"
              >
                <span>
                  <strong>{m.clientName}</strong> — {m.date} {m.time}{" "}
                  <span className="text-muted-foreground">({reasonLabel(m.reason)})</span>
                </span>
                <Link
                  href={`/admin/bookings/${m.bookingId}`}
                  className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-brand-700 hover:underline"
                >
                  Open <ExternalLink className="h-3 w-3" />
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Missing — auto-recreated */}
      {fixedMissing.length > 0 && (
        <div className="space-y-2">
          <h4 className="flex items-center gap-1.5 text-sm font-semibold text-green-700">
            <CheckCircle2 className="h-4 w-4" /> Auto-recreated ({fixedMissing.length})
          </h4>
          <ul className="space-y-1.5">
            {fixedMissing.map((m) => (
              <li
                key={m.bookingId}
                className="rounded-md border border-green-200 bg-green-50/50 px-3 py-2 text-sm"
              >
                <strong>{m.clientName}</strong> — {m.date} {m.time} · recreated in Outlook
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Stale / wrong events in Outlook (no matching booking) */}
      {result.orphaned.length > 0 && (
        <div className="space-y-2">
          <h4 className="flex items-center gap-1.5 text-sm font-semibold text-amber-700">
            <CalendarClock className="h-4 w-4" /> Stale / wrong events in Outlook ({result.orphaned.length})
          </h4>
          <p className="text-xs text-muted-foreground">
            These events are on the calendar but have <strong>no matching booking</strong> at that time — usually
            leftover events from a past reschedule/cancel. This is what makes a session look &quot;at the wrong
            time&quot;. Delete them manually in Outlook.
          </p>
          <ul className="space-y-1.5">
            {result.orphaned.map((o) => (
              <li
                key={o.graphEventId}
                className="rounded-md border border-amber-200 bg-amber-50/50 px-3 py-2 text-sm"
              >
                <strong>{o.subject}</strong> — {o.date}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Bookings on public holidays */}
      {result.onHoliday.length > 0 && (
        <div className="space-y-2">
          <h4 className="flex items-center gap-1.5 text-sm font-semibold text-amber-700">
            <CalendarX className="h-4 w-4" /> Bookings on public holidays ({result.onHoliday.length})
          </h4>
          <p className="text-xs text-muted-foreground">
            These confirmed bookings fall on SA public holidays. Confirm whether they should be cancelled.
          </p>
          <ul className="space-y-1.5">
            {result.onHoliday.map((h) => (
              <li
                key={h.bookingId}
                className="flex items-center justify-between gap-3 rounded-md border border-amber-200 bg-amber-50/50 px-3 py-2 text-sm"
              >
                <span>
                  <strong>{h.clientName}</strong> — {h.date} {h.time}
                </span>
                <Link
                  href={`/admin/bookings/${h.bookingId}`}
                  className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-brand-700 hover:underline"
                >
                  Open <ExternalLink className="h-3 w-3" />
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Errors */}
      {result.errors.length > 0 && (
        <div className="space-y-2">
          <h4 className="flex items-center gap-1.5 text-sm font-semibold text-red-700">
            <XCircle className="h-4 w-4" /> Could not be checked ({result.errors.length})
          </h4>
          <p className="text-xs text-muted-foreground">
            Graph API errors — these bookings were skipped. Re-run the check; if they persist, copy the report
            and send it over.
          </p>
          <ul className="max-h-40 space-y-1 overflow-auto rounded-md border bg-muted/40 p-2 text-xs text-muted-foreground">
            {result.errors.map((e) => (
              <li key={e} className="border-b border-border/50 pb-1 last:border-0">{e}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Raw data for power users */}
      <details className="text-xs">
        <summary className="cursor-pointer text-muted-foreground hover:text-foreground">Raw data</summary>
        <pre className="mt-2 max-h-64 overflow-auto rounded bg-muted p-3">{JSON.stringify(result, null, 2)}</pre>
      </details>
    </div>
  );
}

function cmpKey(date: string, start: string, name: string): string {
  return `${date}|${start}|${name.toLowerCase().replace(/\s+/g, " ").trim()}`;
}

function WeekComparison({
  portal,
  events,
}: Readonly<{
  portal: DiagnosticsResponse["portal"];
  events: NonNullable<DiagnosticsResponse["account"]["upcomingEvents"]>;
}>) {
  const portalKeys = new Set(portal.map((p) => cmpKey(p.date, p.start, p.clientName)));

  // Session events use the "{label} — {client}" pattern; others are personal.
  const teamsSession = events
    .filter((e) => e.subject.includes(" — "))
    .map((e) => ({
      ...e,
      date: e.start.slice(0, 10),
      time: e.start.slice(11, 16),
      clientName: e.subject.split(" — ").slice(1).join(" — ").trim(),
    }));
  const teamsKeys = new Set(teamsSession.map((e) => cmpKey(e.date, e.time, e.clientName)));

  const ghostCount = teamsSession.filter(
    (e) => !portalKeys.has(cmpKey(e.date, e.time, e.clientName)),
  ).length;
  const missingInTeams = portal.filter(
    (p) => !teamsKeys.has(cmpKey(p.date, p.start, p.clientName)),
  ).length;

  return (
    <div className="space-y-3">
      {(ghostCount > 0 || missingInTeams > 0) && (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          {missingInTeams > 0 && <div>⚠ {missingInTeams} portal booking(s) have no matching Teams event.</div>}
          {ghostCount > 0 && (
            <div>⚠ {ghostCount} Teams event(s) have no matching booking — these are ghost/stale events.</div>
          )}
        </div>
      )}
      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <h4 className="mb-1.5 text-sm font-semibold">Portal bookings ({portal.length})</h4>
          {portal.length === 0 ? (
            <p className="text-xs text-muted-foreground">No bookings in this range.</p>
          ) : (
            <ul className="space-y-1 text-sm">
              {portal.map((p) => {
                const inTeams = teamsKeys.has(cmpKey(p.date, p.start, p.clientName));
                return (
                  <li
                    key={p.bookingId}
                    className={`rounded border px-2 py-1 ${inTeams ? "" : "border-red-200 bg-red-50"}`}
                  >
                    {p.date} {p.start}–{p.end} · {p.clientName}
                    {!inTeams && <span className="ml-1 text-xs font-medium text-red-700">· not in Teams</span>}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
        <div>
          <h4 className="mb-1.5 text-sm font-semibold">Teams / Outlook events ({events.length})</h4>
          {events.length === 0 ? (
            <p className="text-xs text-muted-foreground">No events on the connected calendar in this range.</p>
          ) : (
            <ul className="space-y-1 text-sm">
              {events.map((e, i) => {
                const isSession = e.subject.includes(" — ");
                const name = isSession ? e.subject.split(" — ").slice(1).join(" — ").trim() : "";
                const ghost = isSession && !portalKeys.has(cmpKey(e.start.slice(0, 10), e.start.slice(11, 16), name));
                return (
                  <li
                    key={`${e.subject}-${e.start}-${i}`}
                    className={`rounded border px-2 py-1 ${ghost ? "border-amber-300 bg-amber-50" : ""}`}
                  >
                    {e.start.slice(11, 16)}–{e.end} · {e.subject}
                    {e.isOnlineMeeting && <span className="ml-1 text-xs text-brand-700">· Teams</span>}
                    {ghost && <span className="ml-1 text-xs font-medium text-amber-700">· ghost (no booking)</span>}
                    {!isSession && <span className="ml-1 text-xs text-muted-foreground">· personal</span>}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

export function CalendarSyncSection({
  recentLogs,
  lastReconcileResult,
  lastReconcileAt,
}: CalendarSyncSectionProps) {
  const [isPending, startTransition] = useTransition();
  const [reconcileResult, setReconcileResult] = useState<ReconcileResult | null>(null);
  const [ranMode, setRanMode] = useState<string>("");
  const [ranAt, setRanAt] = useState<Date | null>(null);
  const [diag, setDiag] = useState<DiagnosticsResponse | null>(null);
  const [diagLoading, setDiagLoading] = useState(false);
  const [diagStart, setDiagStart] = useState("");
  const [diagEnd, setDiagEnd] = useState("");

  function handleDiagnostics() {
    setDiagLoading(true);
    const params = new URLSearchParams();
    if (diagStart) params.set("start", diagStart);
    if (diagEnd) params.set("end", diagEnd);
    fetch(`/api/admin/calendar-diagnostics?${params.toString()}`)
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Diagnostics failed");
        setDiag(data as DiagnosticsResponse);
      })
      .catch((err) => toast.error(err instanceof Error ? err.message : "Diagnostics failed"))
      .finally(() => setDiagLoading(false));
  }

  function handleReconcile(autoFix: boolean) {
    if (
      !confirm(
        autoFix
          ? "Run reconciliation and auto-fix missing events? This creates new calendar events for bookings that are missing from Outlook."
          : "Run reconciliation in check-only mode? No changes will be made.",
      )
    )
      return;

    startTransition(async () => {
      try {
        const res = await fetch(`/api/admin/reconcile-calendar`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ autoFix }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Reconciliation failed");
        setReconcileResult(data as ReconcileResult);
        setRanMode(autoFix ? "Check & auto-fix" : "Check only");
        setRanAt(new Date());
        toast.success(
          `Reconciliation complete: ${data.matched} matched, ${data.mismatched?.length || 0} mismatched, ${data.fixed || 0} fixed`,
        );
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Reconciliation failed");
      }
    });
  }

  const statusIcon: Record<string, React.ReactNode> = {
    success: <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />,
    failed: <XCircle className="h-3.5 w-3.5 text-red-600" />,
    partial: <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />,
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Connection Check — Portal vs Teams</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Pulls live data straight from the calendar we&apos;re connected to. Use it to confirm we&apos;re reading
            the same Outlook/Teams calendar Roxanne sees — pick a date range and compare side by side.
          </p>
          <div className="flex flex-wrap items-end gap-2">
            <label className="text-xs text-muted-foreground">
              From
              <input
                type="date"
                value={diagStart}
                onChange={(e) => setDiagStart(e.target.value)}
                className="mt-1 block rounded-md border px-2 py-1 text-sm"
              />
            </label>
            <label className="text-xs text-muted-foreground">
              To
              <input
                type="date"
                value={diagEnd}
                onChange={(e) => setDiagEnd(e.target.value)}
                className="mt-1 block rounded-md border px-2 py-1 text-sm"
              />
            </label>
            <Button variant="outline" size="sm" onClick={handleDiagnostics} disabled={diagLoading}>
              <RefreshCw className={`mr-1 h-3.5 w-3.5 ${diagLoading ? "animate-spin" : ""}`} />
              Check connection &amp; compare
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Leave blank for the next 7 days. (e.g. set 2026-07-20 → 2026-07-24.)
          </p>

          {diag && (
            <div className="space-y-4">
              {/* Connected account banner — only a calendar-read error is fatal */}
              <div
                className={`rounded-md border px-3 py-2 text-sm ${
                  diag.account.error
                    ? "border-red-200 bg-red-50 text-red-800"
                    : "border-green-200 bg-green-50 text-green-800"
                }`}
              >
                {diag.account.error ? (
                  <span>Calendar read failed: {diag.account.error}</span>
                ) : (
                  <span>
                    Connected to{" "}
                    <strong>{diag.account.displayName ?? diag.account.configuredEmail ?? "unknown"}</strong>
                    {diag.account.mail ? ` <${diag.account.mail}>` : ""}
                  </span>
                )}
                <span className="ml-1 text-muted-foreground">
                  — is this the calendar Roxanne uses in Teams?
                </span>
              </div>

              {/* Identity lookup failed but calendar read is what matters */}
              {diag.account.identityError && !diag.account.error && (
                <p className="text-xs text-muted-foreground">
                  (Couldn&apos;t read the account name — the app lacks the User.Read.All permission — but the
                  calendar read below succeeded, which is what matters.)
                </p>
              )}

              {/* Side-by-side week with cross-matching */}
              <WeekComparison portal={diag.portal} events={diag.account.upcomingEvents ?? []} />
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Calendar Reconciliation</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {lastReconcileAt && (
            <p className="text-sm text-muted-foreground">
              Last automated run: {format(new Date(lastReconcileAt), "d MMM yyyy, HH:mm")}
              {lastReconcileResult && (
                <>
                  {" "}— {(lastReconcileResult as { matched?: number }).matched || 0} matched,{" "}
                  {(lastReconcileResult as { mismatched?: number }).mismatched || 0} mismatched,{" "}
                  {(lastReconcileResult as { fixed?: number }).fixed || 0} auto-fixed
                </>
              )}
            </p>
          )}
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleReconcile(false)}
              disabled={isPending}
            >
              <RefreshCw className={`mr-1 h-3.5 w-3.5 ${isPending ? "animate-spin" : ""}`} />
              Check Only
            </Button>
            <Button size="sm" onClick={() => handleReconcile(true)} disabled={isPending}>
              <RefreshCw className={`mr-1 h-3.5 w-3.5 ${isPending ? "animate-spin" : ""}`} />
              Check &amp; Auto-Fix
            </Button>
          </div>

          {isPending && (
            <p className="text-sm text-muted-foreground">Checking every upcoming booking against Outlook…</p>
          )}

          {reconcileResult && ranAt && !isPending && (
            <ReconcileReport result={reconcileResult} mode={ranMode} ranAt={ranAt} />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recent Sync Activity</CardTitle>
        </CardHeader>
        <CardContent>
          {recentLogs.length === 0 ? (
            <p className="text-sm text-muted-foreground">No sync activity recorded yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs text-muted-foreground">
                    <th className="px-3 py-2">Time</th>
                    <th className="px-3 py-2">Operation</th>
                    <th className="px-3 py-2">Status</th>
                    <th className="px-3 py-2">Details</th>
                  </tr>
                </thead>
                <tbody>
                  {recentLogs.map((log) => (
                    <tr key={log.id} className="border-b last:border-0">
                      <td className="whitespace-nowrap px-3 py-2 text-muted-foreground">
                        {format(new Date(log.createdAt), "d MMM HH:mm")}
                      </td>
                      <td className="px-3 py-2">{log.operation}</td>
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-1">
                          {statusIcon[log.status]}
                          <Badge
                            variant={
                              log.status === "success"
                                ? "default"
                                : log.status === "failed"
                                  ? "destructive"
                                  : "secondary"
                            }
                            className="text-xs"
                          >
                            {log.status}
                          </Badge>
                        </div>
                      </td>
                      <td className="px-3 py-2 text-xs text-muted-foreground">
                        {log.errorMessage ||
                          (log.metadata ? JSON.stringify(log.metadata).slice(0, 80) : "—")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
