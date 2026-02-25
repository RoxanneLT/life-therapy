import { prisma } from "@/lib/prisma";
import { differenceInDays, addMonths } from "date-fns";

// ── Types ────────────────────────────────────────────────────

export interface ClientInsights {
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
  creditsExpiringSoon: { count: number; expiryDate: Date } | null;
  flags: InsightFlag[];
}

export type InsightFlag =
  | { type: "credit_expiry"; message: string; severity: "warning" }
  | { type: "engagement_gap"; message: string; severity: "warning" }
  | { type: "high_cancel_rate"; message: string; severity: "info" }
  | { type: "no_upcoming"; message: string; severity: "info" };

// ── Rate label helper ────────────────────────────────────────

export function getRateLabel(rate: number): {
  label: string;
  color: "green" | "amber" | "red";
} {
  if (rate <= 10) return { label: "Very low", color: "green" };
  if (rate <= 20) return { label: "Low", color: "green" };
  if (rate <= 35) return { label: "Moderate", color: "amber" };
  return { label: "High", color: "red" };
}

// ── Main insights function ───────────────────────────────────

export async function getClientInsights(
  studentId: string,
): Promise<ClientInsights> {
  const [bookings, creditBalance, creditTransactions, upcomingCount] =
    await Promise.all([
      prisma.booking.findMany({
        where: { studentId },
        orderBy: { date: "asc" },
        select: {
          id: true,
          date: true,
          status: true,
          isLateCancel: true,
          rescheduleCount: true,
        },
      }),
      prisma.sessionCreditBalance.findUnique({
        where: { studentId },
        select: { balance: true },
      }),
      prisma.sessionCreditTransaction.findMany({
        where: { studentId, type: "purchase" },
        orderBy: { createdAt: "desc" },
        select: { amount: true, createdAt: true },
      }),
      prisma.booking.count({
        where: {
          studentId,
          status: { in: ["pending", "confirmed"] },
          date: { gte: new Date() },
        },
      }),
    ]);

  const totalBookings = bookings.length;
  const completedSessions = bookings.filter(
    (b) => b.status === "completed",
  ).length;
  const cancelledSessions = bookings.filter(
    (b) => b.status === "cancelled",
  ).length;
  const lateCancels = bookings.filter((b) => b.isLateCancel).length;
  const noShows = bookings.filter((b) => b.status === "no_show").length;

  // Attendance rate: completed / (completed + noShows + lateCancels)
  const attendanceDenominator = completedSessions + noShows + lateCancels;
  const attendanceRate =
    attendanceDenominator > 0
      ? Math.round((completedSessions / attendanceDenominator) * 100)
      : 0;

  // Completed sessions sorted by date for streak / gap calculations
  const completedDates = bookings
    .filter((b) => b.status === "completed")
    .map((b) => new Date(b.date))
    .sort((a, b) => a.getTime() - b.getTime());

  // Streaks: consecutive sessions with <= 21 day gaps
  let currentStreak = 0;
  let longestStreak = 0;
  let streak = 0;

  for (let i = 0; i < completedDates.length; i++) {
    if (i === 0) {
      streak = 1;
    } else {
      const gap = differenceInDays(completedDates[i], completedDates[i - 1]);
      if (gap <= 21) {
        streak++;
      } else {
        streak = 1;
      }
    }
    longestStreak = Math.max(longestStreak, streak);
  }
  currentStreak = streak; // streak at the end is the current one

  // Average days between sessions
  let totalGapDays = 0;
  for (let i = 1; i < completedDates.length; i++) {
    totalGapDays += differenceInDays(completedDates[i], completedDates[i - 1]);
  }
  const avgDaysBetweenSessions =
    completedDates.length > 1
      ? Math.round(totalGapDays / (completedDates.length - 1))
      : 0;

  // Days since last session
  const lastSessionDate =
    completedDates.length > 0
      ? completedDates[completedDates.length - 1]
      : null;
  const daysSinceLastSession = lastSessionDate
    ? differenceInDays(new Date(), lastSessionDate)
    : null;

  // Rates
  const rescheduledCount = bookings.filter(
    (b) => b.rescheduleCount > 0,
  ).length;
  const rescheduleRate =
    totalBookings > 0 ? Math.round((rescheduledCount / totalBookings) * 100) : 0;
  const lateCancelRate =
    totalBookings > 0 ? Math.round((lateCancels / totalBookings) * 100) : 0;
  const noShowRate =
    totalBookings > 0 ? Math.round((noShows / totalBookings) * 100) : 0;

  // Credits
  const creditsRemaining = creditBalance?.balance ?? 0;

  // Credits expiring soon — purchases expire 6 months from purchase date
  const now = new Date();
  const thirtyDaysFromNow = new Date(
    now.getTime() + 30 * 24 * 60 * 60 * 1000,
  );
  let creditsExpiringSoon: ClientInsights["creditsExpiringSoon"] = null;

  for (const txn of creditTransactions) {
    const expiryDate = addMonths(new Date(txn.createdAt), 6);
    if (expiryDate > now && expiryDate <= thirtyDaysFromNow) {
      // This purchase has credits expiring soon
      creditsExpiringSoon = {
        count: txn.amount,
        expiryDate,
      };
      break; // earliest expiring first (sorted desc, so first match is most recent)
    }
  }

  // Flags
  const flags: InsightFlag[] = [];

  if (creditsExpiringSoon) {
    flags.push({
      type: "credit_expiry",
      message: `${creditsExpiringSoon.count} credit${creditsExpiringSoon.count === 1 ? "" : "s"} expire${creditsExpiringSoon.count === 1 ? "s" : ""} soon`,
      severity: "warning",
    });
  }

  if (daysSinceLastSession !== null && daysSinceLastSession > 21) {
    flags.push({
      type: "engagement_gap",
      message: `No sessions in ${daysSinceLastSession} days`,
      severity: "warning",
    });
  }

  if (lateCancelRate > 20) {
    flags.push({
      type: "high_cancel_rate",
      message: `Late cancel rate is ${lateCancelRate}%`,
      severity: "info",
    });
  }

  if (creditsRemaining > 0 && upcomingCount === 0) {
    flags.push({
      type: "no_upcoming",
      message: `${creditsRemaining} credit${creditsRemaining === 1 ? "" : "s"} with no upcoming session`,
      severity: "info",
    });
  }

  return {
    totalBookings,
    completedSessions,
    cancelledSessions,
    lateCancels,
    noShows,
    attendanceRate,
    currentStreak,
    longestStreak,
    avgDaysBetweenSessions,
    daysSinceLastSession,
    rescheduleRate,
    lateCancelRate,
    noShowRate,
    creditsRemaining,
    creditsExpiringSoon,
    flags,
  };
}
