"use client";

import { useState, useTransition } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  CalendarDays,
  GraduationCap,
  Coins,
  ClipboardCheck,
  Pencil,
  Save,
  X,
  BarChart3,
  AlertTriangle,
  Info,
} from "lucide-react";
import { updateAdminNotesAction } from "../../actions";
import { format } from "date-fns";

const ONBOARDING_LABELS: Record<number, string> = {
  0: "Not started",
  1: "Details done",
  2: "Assessment done",
  3: "Complete",
};

const RATE_COLORS = {
  green: "text-green-600",
  amber: "text-amber-600",
  red: "text-red-600",
} as const;

function getRateLabel(rate: number): {
  label: string;
  color: "green" | "amber" | "red";
} {
  if (rate <= 10) return { label: "Very low", color: "green" };
  if (rate <= 20) return { label: "Low", color: "green" };
  if (rate <= 35) return { label: "Moderate", color: "amber" };
  return { label: "High", color: "red" };
}

interface InsightFlag {
  type: string;
  message: string;
  severity: "warning" | "info";
}

interface SerializedInsights {
  totalBookings: number;
  completedSessions: number;
  cancelledSessions: number;
  lateCancels: number;
  noShows: number;
  attendanceRate: number;
  currentStreak: number;
  longestStreak: number;
  avgDaysBetweenSessions: number;
  daysSinceLastSession: number | null;
  rescheduleRate: number;
  lateCancelRate: number;
  noShowRate: number;
  creditsRemaining: number;
  creditsExpiringSoon: { count: number; expiryDate: string } | null;
  flags: InsightFlag[];
}

interface OverviewTabProps {
  client: Record<string, unknown>;
  insights?: SerializedInsights | null;
}

export function OverviewTab({ client, insights }: OverviewTabProps) {
  const [editingNotes, setEditingNotes] = useState(false);
  const [notes, setNotes] = useState((client.adminNotes as string) || "");
  const [isPending, startTransition] = useTransition();

  const bookingsCount =
    (client._count as Record<string, number>)?.bookings ?? 0;
  const enrollmentsCount =
    (client._count as Record<string, number>)?.enrollments ?? 0;
  const creditBalance =
    (client.creditBalance as Record<string, number>)?.balance ?? 0;
  const onboardingStep = (client.onboardingStep as number) || 0;

  function handleSaveNotes() {
    startTransition(async () => {
      await updateAdminNotesAction(client.id as string, notes);
      setEditingNotes(false);
    });
  }

  return (
    <div className="space-y-6">
      {/* Stat cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm text-muted-foreground">
              Sessions
            </CardTitle>
            <CalendarDays className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{bookingsCount}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm text-muted-foreground">
              Courses
            </CardTitle>
            <GraduationCap className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{enrollmentsCount}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm text-muted-foreground">
              Session Credits
            </CardTitle>
            <Coins className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{creditBalance}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm text-muted-foreground">
              Onboarding
            </CardTitle>
            <ClipboardCheck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-lg font-semibold">
              {ONBOARDING_LABELS[onboardingStep] || `Step ${onboardingStep}`}
            </p>
            <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-brand-500 transition-all"
                style={{
                  width: `${Math.round((onboardingStep / 3) * 100)}%`,
                }}
              />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Admin notes */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Admin Notes</CardTitle>
          {!editingNotes ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setEditingNotes(true)}
            >
              <Pencil className="mr-1.5 h-3.5 w-3.5" />
              Edit
            </Button>
          ) : (
            <div className="flex gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setNotes((client.adminNotes as string) || "");
                  setEditingNotes(false);
                }}
                disabled={isPending}
              >
                <X className="mr-1.5 h-3.5 w-3.5" />
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleSaveNotes}
                disabled={isPending}
              >
                <Save className="mr-1.5 h-3.5 w-3.5" />
                {isPending ? "Saving..." : "Save"}
              </Button>
            </div>
          )}
        </CardHeader>
        <CardContent>
          {editingNotes ? (
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={5}
              className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              placeholder="Add private notes about this client..."
            />
          ) : (
            <p className="whitespace-pre-wrap text-sm text-muted-foreground">
              {(client.adminNotes as string) || "No notes yet."}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Client Insights */}
      <InsightsPanel insights={insights} />
    </div>
  );
}

function InsightsPanel({
  insights,
}: {
  insights?: SerializedInsights | null;
}) {
  if (!insights || insights.totalBookings === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <BarChart3 className="h-4 w-4" />
            Client Insights
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            No session data yet.
          </p>
        </CardContent>
      </Card>
    );
  }

  const rescheduleLabel = getRateLabel(insights.rescheduleRate);
  const lateCancelLabel = getRateLabel(insights.lateCancelRate);
  const noShowLabel = getRateLabel(insights.noShowRate);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <BarChart3 className="h-4 w-4" />
          Client Insights
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Attendance */}
        <div>
          <p className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Attendance
          </p>
          <div className="mb-1.5 h-2.5 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-green-500 transition-all"
              style={{ width: `${insights.attendanceRate}%` }}
            />
          </div>
          <p className="text-sm">
            <strong>{insights.attendanceRate}%</strong> attendance rate
          </p>
          <p className="text-xs text-muted-foreground">
            {insights.completedSessions} completed · {insights.lateCancels}{" "}
            late cancel{insights.lateCancels !== 1 ? "s" : ""} ·{" "}
            {insights.noShows} no-show{insights.noShows !== 1 ? "s" : ""} ·{" "}
            {insights.cancelledSessions} cancelled
          </p>
        </div>

        {/* Engagement */}
        <div>
          <p className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Engagement
          </p>
          <p className="text-sm">
            Current streak: <strong>{insights.currentStreak}</strong>{" "}
            session{insights.currentStreak !== 1 ? "s" : ""} · Longest:{" "}
            <strong>{insights.longestStreak}</strong>
          </p>
          <p className="text-xs text-muted-foreground">
            Avg gap: {insights.avgDaysBetweenSessions} days · Last session:{" "}
            {insights.daysSinceLastSession !== null
              ? `${insights.daysSinceLastSession} day${insights.daysSinceLastSession !== 1 ? "s" : ""} ago`
              : "—"}
          </p>
        </div>

        {/* Patterns */}
        <div>
          <p className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Patterns
          </p>
          <p className="text-sm">
            Reschedule rate:{" "}
            <span className={RATE_COLORS[rescheduleLabel.color]}>
              {rescheduleLabel.label} ({insights.rescheduleRate}%)
            </span>{" "}
            · Late cancel:{" "}
            <span className={RATE_COLORS[lateCancelLabel.color]}>
              {lateCancelLabel.label} ({insights.lateCancelRate}%)
            </span>
          </p>
          <p className="text-sm">
            No-show rate:{" "}
            <span className={RATE_COLORS[noShowLabel.color]}>
              {noShowLabel.label} ({insights.noShowRate}%)
            </span>
          </p>
        </div>

        {/* Flags */}
        {insights.flags.length > 0 && (
          <div className="space-y-1.5 border-t pt-3">
            {insights.flags.map((flag, i) => (
              <div key={i} className="flex items-center gap-2 text-sm">
                {flag.severity === "warning" ? (
                  <AlertTriangle className="h-4 w-4 shrink-0 text-amber-500" />
                ) : (
                  <Info className="h-4 w-4 shrink-0 text-blue-500" />
                )}
                <span
                  className={
                    flag.severity === "warning"
                      ? "text-amber-700"
                      : "text-blue-700"
                  }
                >
                  {flag.message}
                  {flag.type === "credit_expiry" &&
                    insights.creditsExpiringSoon &&
                    ` (${format(new Date(insights.creditsExpiringSoon.expiryDate), "d MMM yyyy")})`}
                </span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
