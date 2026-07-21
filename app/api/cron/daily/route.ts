import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/lib/generated/prisma/client";
import { processSessionReminders } from "@/lib/cron/session-reminders";
import { processGiftDelivery } from "@/lib/cron/gift-delivery";
import { processOrderCleanup } from "@/lib/cron/order-cleanup";
import { processDripEmails } from "@/lib/drip-emails";
import { processCampaigns } from "@/lib/campaign-process";
import { processMonthlyBilling } from "@/lib/cron/monthly-billing";
import { processWhatsAppReminders } from "@/lib/cron/whatsapp-reminders";
import { processBirthdayEmails } from "@/lib/birthday-process";
import { checkBunnyBalance } from "@/lib/cron/bunny-balance-check";
import { processPhoneNormalization } from "@/lib/cron/normalize-phones";
import { sendCronDigest, type CronJobDetail } from "@/lib/cron/cron-digest";
import { collectCronRunFailures, isCronAuthorised } from "@/lib/cron/with-cron-run";
import { missingRequiredEnv } from "@/lib/env";

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
  // Use the shared check — do NOT re-implement it. This route had its own copy,
  // which meant a change to the auth logic (removing the ?secret= query param,
  // making the compare constant-time) would have silently missed the single
  // highest-value endpoint in the system: the orchestrator for all ten jobs.
  if (!isCronAuthorised(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Fail LOUD on a missing required var, once per day, rather than have each of the
  // ten jobs discover it mid-run as a fetch-to-undefined. This runs on the machine
  // that serves requests, so a missing var here means it's missing for the app too.
  const missing = missingRequiredEnv();
  if (missing.length > 0) {
    console.error("[daily-cron] Missing required environment variables:", missing.join(", "));
    return NextResponse.json(
      { error: "Missing required environment variables", missing },
      { status: 500 },
    );
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
  // Safety net — session reminders are primarily driven by the every-2h
  // /api/cron/reminders trigger; this daily pass catches anything missed.
  await runTask("sessionReminders", () => processSessionReminders(), detail);
  await runTask("giftDelivery", () => processGiftDelivery(), detail);
  await runTask("monthlyBilling", () => processMonthlyBilling(), detail);
  await runTask("dripEmails", () => processDripEmails(), detail);
  await runTask("campaignSteps", () => processCampaigns(), detail);
  await runTask("whatsappReminders", () => processWhatsAppReminders(), detail);
  await runTask("birthdayEmails", () => processBirthdayEmails(), detail);
  await runTask("bunnyBalance", () => checkBunnyBalance(), detail);
  // Safety net — canonicalise any stored phone numbers not already in E.164
  await runTask("phoneNormalization", () => processPhoneNormalization(), detail);

  // Dormant follow-up (dynamic import)
  await runTask(
    "dormantFollowUp",
    async () => {
      const { processDormantFollowUp } = await import("@/lib/cron/dormant-follow-up");
      return processDormantFollowUp();
    },
    detail,
  );

  // Calendar reconciliation — CHECK-ONLY (auto-fix gated off 2026-07-21).
  // autoFix's reverse pass deletes recurring-series occurrences it never recreates;
  // combined with the day-of-week bug it deleted 50 of a client's real events. Stays
  // check-only until the fix is deployed and the reverse pass gets a recurring guard.
  // See docs/CALENDAR_SYNC_HANDOVER_2026-07-21.md (bug #5).
  await runTask(
    "calendarReconcile",
    async () => {
      const { reconcileCalendar } = await import("@/lib/calendar-reconcile");
      const r = await reconcileCalendar({ autoFix: false, daysAhead: 365 });
      const unfixedMissing = r.missing.filter((m) => !m.autoFixed).length;
      const unresolvedOrphans = r.orphaned.filter((o) => !o.deleted).length;
      return {
        checked: r.checked,
        matched: r.matched,
        fixed: r.fixed,
        // Surface remaining drift (mismatched + missing + un-deleted stale +
        // holiday) so it shows up in the digest
        failed: r.mismatched.length + unfixedMissing + unresolvedOrphans + r.onHoliday.length,
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
