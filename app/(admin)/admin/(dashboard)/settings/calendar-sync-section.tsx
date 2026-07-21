"use client";

import { useState, useTransition } from "react";
// Shared with the reconciler so the UI and the cron agree on who an event belongs to
// (and both strip the " (In Person)" suffix — bug #3), and on what may safely be done.
import { parseClientName } from "@/lib/calendar-classify";
import type {
  ClassifiedMismatch,
  ClassifiedMissing,
  ClassifiedOrphan,
  ClassifiedDuplicate,
  RepairItem,
} from "@/lib/calendar-classify";
import { applyCalendarRepairsAction } from "./calendar-sync-actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  RefreshCw,
  CheckCircle2,
  XCircle,
  AlertTriangle,
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

interface HolidayDetail {
  bookingId: string;
  clientName: string;
  date: string;
  time: string;
  holiday: string;
}

/** Mirrors lib/calendar-reconcile.ts ReconcileResult — the classification plus context.
 *  Findings carry their own `proposal`; the UI never decides what is safe to do. */
interface ReconcileResult {
  checked: number;
  matched: number;
  mismatched: ClassifiedMismatch[];
  missing: ClassifiedMissing[];
  orphaned: ClassifiedOrphan[];
  duplicates: ClassifiedDuplicate[];
  onHoliday: HolidayDetail[];
  errors: string[];
  scannedEvents?: number;
  sessionEventsScanned?: number;
  missingByClient?: Array<{ client: string; count: number; nextDate: string }>;
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
function buildReport(r: ReconcileResult, ranAt: Date): string {
  const lines: string[] = [];
  lines.push(`Calendar Check — ${format(ranAt, "d MMM yyyy, HH:mm")} (report only — nothing changed)`);
  lines.push(
    `Checked ${r.checked} · Matched ${r.matched} · Missing ${r.missing.length} · ` +
      `Duplicates ${r.duplicates.length} · Unmatched events ${r.orphaned.length} · ` +
      `Wrong duration ${r.mismatched.length} · Holiday ${r.onHoliday.length} · Errors ${r.errors.length}`,
  );

  if (r.missingByClient?.length) {
    lines.push("", "SESSIONS WITH NO CALENDAR EVENT, by client (soonest first):");
    for (const m of r.missingByClient) {
      lines.push(`  • ${m.client} — ${m.count} session(s), next ${m.nextDate}`);
    }
  }

  const rebuild = r.missing.filter((m) => m.proposal === "reschedule_series");
  const create = r.missing.filter((m) => m.proposal === "create");
  if (create.length) {
    lines.push("", `MISSING — single sessions, can be recreated (${create.length}):`);
    for (const m of create) {
      lines.push(`  • ${m.clientName} ${m.date} ${m.time} — ${reasonLabel(m.reason)}`);
    }
  }
  if (rebuild.length) {
    lines.push("", `MISSING — recurring, REBUILD THE SERIES (${rebuild.length}):`);
    for (const m of rebuild) lines.push(`  • ${m.clientName} ${m.date} ${m.time}`);
  }

  const dupDelete = r.duplicates.filter((d) => d.proposal === "delete");
  const dupReview = r.duplicates.filter((d) => d.proposal !== "delete");
  if (dupDelete.length) {
    lines.push("", `DUPLICATES — surplus event in a slot that already has one (${dupDelete.length}):`);
    for (const d of dupDelete) lines.push(`  • ${d.subject} — ${d.date} ${d.start}`);
  }
  if (dupReview.length) {
    lines.push("", `DUPLICATES — NEEDS A DECISION, ownership unclear (${dupReview.length}):`);
    for (const d of dupReview) lines.push(`  • ${d.subject} — ${d.date} ${d.start}`);
  }

  const ghosts = r.orphaned.filter((o) => o.deletable);
  const protectedGhosts = r.orphaned.filter((o) => !o.deletable);
  if (ghosts.length) {
    lines.push("", `UNMATCHED EVENTS — no booking, safe to delete (${ghosts.length}):`);
    for (const o of ghosts) lines.push(`  • ${o.subject} — ${o.date} ${o.start}`);
  }
  if (protectedGhosts.length) {
    lines.push(
      "",
      `SUSPECTED WRONG-DAY SESSIONS (${protectedGhosts.length}) — DO NOT DELETE.`,
      "  These clients still have sessions with no event. Rebuild their series instead;",
      "  deleting these wipes real sessions off the calendar.",
    );
    for (const o of protectedGhosts) lines.push(`  • ${o.subject} — ${o.date} ${o.start}`);
  }

  if (r.onHoliday.length) {
    lines.push("", `BOOKINGS ON PUBLIC HOLIDAYS (${r.onHoliday.length}):`);
    for (const h of r.onHoliday) lines.push(`  • ${h.clientName} ${h.date} ${h.time}`);
  }

  if (r.errors.length) {
    lines.push("", `ERRORS (${r.errors.length}):`);
    for (const e of r.errors) lines.push(`  • ${e}`);
  }

  if (
    !r.mismatched.length &&
    !r.missing.length &&
    !r.orphaned.length &&
    !r.duplicates.length &&
    !r.onHoliday.length &&
    !r.errors.length
  ) {
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

/** A group of findings the admin can approve, or a read-only group they cannot. */
function FindingGroup({
  title,
  note,
  tone,
  items,
  selected,
  onToggle,
  onToggleAll,
}: Readonly<{
  title: string;
  note?: string;
  tone: "warn" | "bad" | "neutral";
  items: Array<{ key: string; label: string; sub?: string }>;
  /** Omit to render read-only (no checkboxes) — used for anything not safe to automate. */
  selected?: Set<string>;
  onToggle?: (key: string) => void;
  onToggleAll?: (keys: string[], on: boolean) => void;
}>) {
  if (items.length === 0) return null;
  const approvable = !!selected && !!onToggle;
  const keys = items.map((i) => i.key);
  const allOn = approvable && keys.every((k) => selected.has(k));
  const toneClass =
    tone === "bad"
      ? "border-red-200 bg-red-50"
      : tone === "warn"
        ? "border-amber-200 bg-amber-50"
        : "border-border bg-muted/30";

  return (
    <div className={`rounded-md border p-3 ${toneClass}`}>
      <div className="mb-1 flex items-center justify-between gap-2">
        <h4 className="text-sm font-semibold">
          {title} ({items.length})
        </h4>
        {approvable && onToggleAll && (
          <button
            type="button"
            className="text-xs text-brand-600 hover:underline"
            onClick={() => onToggleAll(keys, !allOn)}
          >
            {allOn ? "Clear all" : "Select all"}
          </button>
        )}
      </div>
      {note && <p className="mb-2 text-xs text-muted-foreground">{note}</p>}
      <ul className="max-h-56 space-y-1 overflow-auto text-sm">
        {items.map((i) => (
          <li key={i.key} className="flex items-start gap-2 rounded px-1 py-0.5">
            {approvable ? (
              <input
                type="checkbox"
                className="mt-1"
                checked={selected.has(i.key)}
                onChange={() => onToggle(i.key)}
                aria-label={i.label}
              />
            ) : (
              <span className="mt-1 text-muted-foreground">•</span>
            )}
            <span>
              {i.label}
              {i.sub && <span className="block text-xs text-muted-foreground">{i.sub}</span>}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ReconcileReport({
  result,
  ranAt,
  onApplied,
}: Readonly<{ result: ReconcileResult; ranAt: Date; onApplied: () => void }>) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [isApplying, startApply] = useTransition();
  const [confirmOpen, setConfirmOpen] = useState(false);

  // Split every finding by what the SERVER proposed. The UI never decides what is safe;
  // it only offers what classify() already judged safe, and the apply step re-verifies.
  const createable = result.missing.filter((m) => m.proposal === "create");
  const needsRebuild = result.missing.filter((m) => m.proposal === "reschedule_series");
  const dupDelete = result.duplicates.filter((d) => d.proposal === "delete");
  const dupReview = result.duplicates.filter((d) => d.proposal !== "delete");
  const ghosts = result.orphaned.filter((o) => o.deletable);
  const protectedGhosts = result.orphaned.filter((o) => !o.deletable);

  const issueCount =
    result.mismatched.length +
    result.missing.length +
    result.orphaned.length +
    result.duplicates.length +
    result.onHoliday.length +
    result.errors.length;

  function toggle(key: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function toggleAll(keys: string[], on: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      for (const k of keys) {
        if (on) next.add(k);
        else next.delete(k);
      }
      return next;
    });
  }

  const chosenDeletes = [...selected].filter((k) => k.startsWith("delete:")).length;
  const chosenCreates = [...selected].filter((k) => k.startsWith("create:")).length;

  // Say exactly what pressing the button will do — never "fix everything".
  const summary = [
    chosenDeletes > 0 ? `Delete ${chosenDeletes} event${chosenDeletes === 1 ? "" : "s"}` : null,
    chosenCreates > 0 ? `create ${chosenCreates} missing event${chosenCreates === 1 ? "" : "s"}` : null,
  ]
    .filter(Boolean)
    .join(", ");

  function apply() {
    const items: RepairItem[] = [...selected].map((k) => {
      const [action, id] = [k.slice(0, k.indexOf(":")), k.slice(k.indexOf(":") + 1)];
      return action === "delete"
        ? { action: "delete", graphEventId: id }
        : { action: "create", bookingId: id };
    });

    startApply(async () => {
      try {
        const res = await applyCalendarRepairsAction(items);
        if (res.applied > 0) toast.success(`${res.applied} repair(s) applied.`);
        if (res.skipped > 0) toast.warning(`${res.skipped} skipped — state changed since approval.`);
        if (res.failed > 0) toast.error(`${res.failed} failed. See the outcomes below.`);
        if (res.applied === 0 && res.skipped === 0 && res.failed === 0) {
          toast.info("Nothing to do.");
        }
        setSelected(new Set());
        setConfirmOpen(false);
        onApplied();
      } catch {
        toast.error("Could not apply repairs — nothing was changed.");
      }
    });
  }

  function handleCopy() {
    navigator.clipboard.writeText(buildReport(result, ranAt)).then(
      () => toast.success("Report copied to clipboard"),
      () => toast.error("Could not copy — select and copy manually"),
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          {format(ranAt, "d MMM yyyy, HH:mm")} · report only — nothing has been changed
        </p>
        <Button variant="ghost" size="sm" onClick={handleCopy}>
          Copy report
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <StatChip label="Checked" value={result.checked} tone="neutral" />
        <StatChip label="Matched" value={result.matched} tone="good" />
        <StatChip label="No event" value={result.missing.length} tone={result.missing.length ? "bad" : "good"} />
        <StatChip
          label="Needs review"
          value={result.orphaned.length + result.duplicates.length}
          tone={result.orphaned.length + result.duplicates.length ? "warn" : "good"}
        />
      </div>

      {issueCount === 0 && (
        <div className="rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800">
          ✓ Every booking matches Outlook. Nothing to do.
        </div>
      )}

      {result.missingByClient && result.missingByClient.length > 0 && (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          <strong>Sessions with no calendar event</strong> (soonest first):
          <ul className="mt-1 space-y-0.5 text-xs">
            {result.missingByClient.map((m) => (
              <li key={m.client}>
                {m.client} — {m.count} session(s), next {m.nextDate}
              </li>
            ))}
          </ul>
        </div>
      )}

      <FindingGroup
        title="Missing — can be recreated"
        note="Single sessions with no calendar event. Recreating sends the client a fresh invite."
        tone="bad"
        items={createable.map((m) => ({
          key: `create:${m.bookingId}`,
          label: `${m.clientName} — ${m.date} ${m.time}`,
          sub: reasonLabel(m.reason),
        }))}
        selected={selected}
        onToggle={toggle}
        onToggleAll={toggleAll}
      />

      <FindingGroup
        title="Missing — recurring, rebuild the series"
        note="Creating a single occurrence would fork the series and hand the client a different meeting. Open the booking and use 'Rebuild calendar' instead."
        tone="bad"
        items={needsRebuild.map((m) => ({
          key: `rebuild:${m.bookingId}`,
          label: `${m.clientName} — ${m.date} ${m.time}`,
        }))}
      />

      <FindingGroup
        title="Duplicates — surplus event in a booked slot"
        note="The booking owns a different event in this slot, so this one is spare."
        tone="warn"
        items={dupDelete.map((d) => ({
          key: `delete:${d.graphEventId}`,
          label: `${d.subject} — ${d.date} ${d.start}`,
          sub: d.reason,
        }))}
        selected={selected}
        onToggle={toggle}
        onToggleAll={toggleAll}
      />

      <FindingGroup
        title="Duplicates — needs your decision"
        note="Several events share a slot and none is linked to the booking. Deleting the wrong one would break the invite the client is holding, so pick manually in Outlook."
        tone="warn"
        items={dupReview.map((d) => ({
          key: `review:${d.graphEventId}`,
          label: `${d.subject} — ${d.date} ${d.start}`,
        }))}
      />

      <FindingGroup
        title="Events with no booking"
        note="Nothing in the portal corresponds to these, and the client they belong to has no missing sessions — safe to remove."
        tone="warn"
        items={ghosts.map((o) => ({
          key: `delete:${o.graphEventId}`,
          label: `${o.subject} — ${o.date} ${o.start}`,
        }))}
        selected={selected}
        onToggle={toggle}
        onToggleAll={toggleAll}
      />

      <FindingGroup
        title="Suspected wrong-day sessions — do NOT delete"
        note="These clients still have sessions with no calendar event, so these are very likely their real sessions sitting on the wrong day. Rebuild the client's series instead; deleting them wipes real sessions off the calendar."
        tone="bad"
        items={protectedGhosts.map((o) => ({
          key: `protected:${o.graphEventId}`,
          label: `${o.subject} — ${o.date} ${o.start}`,
          sub: o.reason,
        }))}
      />

      <FindingGroup
        title="Wrong duration"
        note="The booking and the calendar event start together but end at different times. Reported only."
        tone="neutral"
        items={result.mismatched.map((m) => ({
          key: `mismatch:${m.bookingId}`,
          label: `${m.clientName} — ${m.date}`,
          sub: `booking ${m.bookingTime} vs Outlook ${m.outlookTime}`,
        }))}
      />

      <FindingGroup
        title="Bookings on public holidays"
        tone="neutral"
        items={result.onHoliday.map((h) => ({
          key: `holiday:${h.bookingId}`,
          label: `${h.clientName} — ${h.date} ${h.time}`,
        }))}
      />

      {result.errors.length > 0 && (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">
          <strong>Errors ({result.errors.length}):</strong>
          <ul className="mt-1 space-y-0.5">
            {result.errors.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        </div>
      )}

      {selected.size > 0 && (
        <div className="sticky bottom-0 flex items-center justify-between gap-2 rounded-md border bg-background px-3 py-2 shadow-sm">
          <span className="text-sm font-medium">{summary}</span>
          <Button size="sm" onClick={() => setConfirmOpen(true)} disabled={isApplying}>
            {isApplying ? "Applying…" : `Apply ${selected.size} change${selected.size === 1 ? "" : "s"}`}
          </Button>
        </div>
      )}

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Apply these calendar changes?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-sm">
                <p>
                  <strong>{summary}.</strong>
                </p>
                <p>
                  Each change is re-checked against Outlook immediately before it runs. Anything
                  that no longer applies is skipped and reported rather than forced.
                </p>
                {chosenCreates > 0 && (
                  <p className="text-amber-700">
                    Creating an event sends the client a fresh calendar invite.
                  </p>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isApplying}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                apply();
              }}
              disabled={isApplying}
            >
              {isApplying ? "Applying…" : "Apply changes"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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
      clientName: parseClientName(e.subject),
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
                const name = isSession ? parseClientName(e.subject) : "";
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
  const [ranAt, setRanAt] = useState<Date | null>(null);
  const [diag, setDiag] = useState<DiagnosticsResponse | null>(null);
  const [diagLoading, setDiagLoading] = useState(false);
  const [diagStart, setDiagStart] = useState("");
  const [diagEnd, setDiagEnd] = useState("");

  // Drift carried over from the last SCHEDULED run, so the card shows a problem even
  // when nobody has pressed anything this session. Silence should mean "verified clean",
  // not "nobody looked" — that distinction is what let a broken series sit for 12 days.
  const lastRun = (lastReconcileResult ?? {}) as Record<string, number | undefined>;
  const driftFromLastRun =
    (lastRun.missing ?? 0) + (lastRun.orphaned ?? 0) + (lastRun.duplicates ?? 0);

  function handleDiagnostics() {
    setDiagLoading(true);
    const params = new URLSearchParams();
    if (diagStart) params.set("start", diagStart);
    if (diagEnd) params.set("end", diagEnd);
    fetch(`/api/admin/calendar-diagnostics?${params.toString()}`)
      .then(async (res) => {
        const text = await res.text();
        let data: DiagnosticsResponse & { error?: string };
        try {
          data = JSON.parse(text);
        } catch {
          throw new Error(`Server error (${res.status}). ${text.slice(0, 120)}`);
        }
        if (!res.ok) throw new Error(data.error || "Diagnostics failed");
        setDiag(data);
      })
      .catch((err) => toast.error(err instanceof Error ? err.message : "Diagnostics failed"))
      .finally(() => setDiagLoading(false));
  }

  /** Run a check. This NEVER changes anything — repairs are approved item-by-item in
   *  the report below and applied through a separate, re-verified step. */
  function handleReconcile() {
    startTransition(async () => {
      try {
        const res = await fetch(`/api/admin/reconcile-calendar`, { method: "POST" });
        const text = await res.text();
        let data: ReconcileResult & { error?: string };
        try {
          data = JSON.parse(text);
        } catch {
          throw new Error(
            res.status === 504
              ? "Timed out — too many bookings to check in one go. Try again."
              : `Server error (${res.status}). ${text.slice(0, 120)}`,
          );
        }
        if (!res.ok) throw new Error(data.error || "Check failed");
        setReconcileResult(data);
        setRanAt(new Date());
        const issues =
          (data.missing?.length ?? 0) +
          (data.orphaned?.length ?? 0) +
          (data.duplicates?.length ?? 0);
        if (issues === 0) {
          toast.success(`All clear — ${data.matched} booking(s) match Outlook.`);
        } else {
          toast.warning(`${issues} item(s) need review. Nothing has been changed.`);
        }
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
          <div className="flex items-center justify-between gap-2">
            <CardTitle className="text-base">Calendar Reconciliation</CardTitle>
            {/* Drift badge — the last scheduled run's own numbers, so a problem is
                visible on the page without anyone remembering to press anything. */}
            {driftFromLastRun > 0 && (
              <Badge variant="destructive">
                <AlertTriangle className="mr-1 h-3 w-3" />
                {driftFromLastRun} need{driftFromLastRun === 1 ? "s" : ""} review
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {lastReconcileAt && (
            <p className="text-sm text-muted-foreground">
              Last automated run: {format(new Date(lastReconcileAt), "d MMM yyyy, HH:mm")}
              {lastReconcileResult && (
                <>
                  {" "}— {(lastReconcileResult as { matched?: number }).matched || 0} matched,{" "}
                  {(lastReconcileResult as { missing?: number }).missing || 0} with no event
                </>
              )}
            </p>
          )}
          <div className="flex gap-2">
            <Button size="sm" onClick={handleReconcile} disabled={isPending}>
              <RefreshCw className={`mr-1 h-3.5 w-3.5 ${isPending ? "animate-spin" : ""}`} />
              Run check
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            A check never changes anything. Repairs are proposed below, approved one by one, and
            re-verified against Outlook at the moment they run.
          </p>

          {isPending && (
            <p className="text-sm text-muted-foreground">Checking every upcoming booking against Outlook…</p>
          )}

          {reconcileResult && ranAt && !isPending && (
            <ReconcileReport
              result={reconcileResult}
              ranAt={ranAt}
              onApplied={handleReconcile}
            />
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
