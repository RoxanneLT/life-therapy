import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/lib/generated/prisma/client";
import { processBookingReminders } from "@/lib/cron/booking-reminders";
import { processGiftDelivery } from "@/lib/cron/gift-delivery";
import { processOrderCleanup } from "@/lib/cron/order-cleanup";
import { processDripEmails } from "@/lib/drip-emails";
import { processCampaigns } from "@/lib/campaign-process";
import { processMonthlyBilling } from "@/lib/cron/monthly-billing";
import { processWhatsAppReminders } from "@/lib/cron/whatsapp-reminders";
import { processBirthdayEmails } from "@/lib/birthday-process";
import { checkBunnyBalance } from "@/lib/cron/bunny-balance-check";
import { sendCronDigest, type CronJobDetail } from "@/lib/cron/cron-digest";
import { collectCronRunFailures } from "@/lib/cron/with-cron-run";

/**
 * Combined daily cron — runs at 08:00 SAST (06:00 UTC).
 *
 * Each task is timed and recorded; failures roll up into a single
 * digest email (sent ONLY when something fails). External higher-
 * frequency crons (gift delivery, campaign steps, etc.) log their own
 * runs via withCronRun and their failures are folded in here.
 *
 * Individual cron routes still exist for manual testing / external triggers.
 */

export const maxDuration = 120;

async function runTask(
  name: string,
  fn: () => Promise<unknown>,
  detail: Record<string, CronJobDetail>,
) {
  const start = Date.now();
  try {
    const result = await fn();
    detail[name] = {
      ...(typeof result === "object" && result !== null
        ? (result as Record<string, unknown>)
        : {}),
      status: "ok",
      durationMs: Date.now() - start,
    };
  } catch (err) {
    console.error(`[daily-cron] ${name} failed:`, err);
    detail[name] = {
      status: "error",
      durationMs: Date.now() - start,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

export async function GET(request: NextRequest) {
  const secret =
    request.headers.get("x-cron-secret") ??
    request.headers.get("authorization")?.replace("Bearer ", "") ??
    new URL(request.url).searchParams.get("secret");
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const startedAt = new Date();
  const detail: Record<string, CronJobDetail> = {};

  // Write cron_runs entry (status: running)
  let cronRunId: string | null = null;
  try {
    const run = await prisma.cronRun.create({
      data: { jobName: "daily", startedAt, status: "running" },
    });
    cronRunId = run.id;
  } catch {
    /* logging must not block execution */
  }

  // Run all tasks sequentially with timing
  await runTask("orderCleanup", () => processOrderCleanup(), detail);
  await runTask("bookingReminders", () => processBookingReminders(), detail);
  await runTask("giftDelivery", () => processGiftDelivery(), detail);
  await runTask("monthlyBilling", () => processMonthlyBilling(), detail);
  await runTask("dripEmails", () => processDripEmails(), detail);
  await runTask("campaignSteps", () => processCampaigns(), detail);
  await runTask("whatsappReminders", () => processWhatsAppReminders(), detail);
  await runTask("birthdayEmails", () => processBirthdayEmails(), detail);
  await runTask("bunnyBalance", () => checkBunnyBalance(), detail);

  // Dormant follow-up (dynamic import)
  await runTask(
    "dormantFollowUp",
    async () => {
      const { processDormantFollowUp } = await import("@/lib/cron/dormant-follow-up");
      return processDormantFollowUp();
    },
    detail,
  );

  // Calendar reconciliation (auto-fix missing events, flag mismatches)
  await runTask(
    "calendarReconcile",
    async () => {
      const { reconcileCalendar } = await import("@/lib/calendar-reconcile");
      const r = await reconcileCalendar({ autoFix: true, daysAhead: 60 });
      const unfixedMissing = r.missing.filter((m) => !m.autoFixed).length;
      return {
        checked: r.checked,
        matched: r.matched,
        fixed: r.fixed,
        // Surface drift as "failed" count so it shows up in the digest
        failed: r.mismatched.length + unfixedMissing,
      };
    },
    detail,
  );

  // Stale sessions count (past confirmed sessions not yet completed) — surfaced for visibility
  await runTask(
    "staleSessionsCheck",
    async () => {
      const cutoff = new Date();
      cutoff.setHours(cutoff.getHours() - 48);
      const count = await prisma.booking.count({
        where: { status: "confirmed", date: { lt: cutoff } },
      });
      return { staleCount: count };
    },
    detail,
  );

  // Fold in external cron failures from the last 24h
  try {
    const externalFailures = await collectCronRunFailures(24);
    Object.assign(detail, externalFailures);
  } catch (err) {
    console.error("[daily-cron] collectCronRunFailures failed:", err);
  }

  // Send digest (failure-only — a clean run sends nothing)
  const digest = await sendCronDigest(startedAt.toISOString(), detail);

  // Update cron_runs entry
  if (cronRunId) {
    try {
      const hasFailures = Object.values(detail).some(
        (d) => d.status === "failed" || d.status === "error" || (d.failed ?? 0) > 0,
      );
      await prisma.cronRun.update({
        where: { id: cronRunId },
        data: {
          finishedAt: new Date(),
          status: hasFailures ? "failed" : "completed",
          rowsProcessed: Object.keys(detail).length,
          metadata: detail as unknown as Prisma.InputJsonValue,
        },
      });
    } catch {
      /* logging must not block response */
    }
  }

  // Housekeeping: purge cron_runs older than 30 days
  try {
    await prisma.cronRun.deleteMany({
      where: { startedAt: { lt: new Date(Date.now() - 30 * 24 * 3600 * 1000) } },
    });
  } catch {
    /* best effort */
  }

  return NextResponse.json({ ok: true, ran_at: startedAt.toISOString(), detail, digest });
}
