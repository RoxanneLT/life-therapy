import { NextRequest } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/lib/generated/prisma/client";
import type { CronJobDetail } from "./cron-digest";

type CronHandler = (req: NextRequest) => Promise<Response>;

/**
 * The ONLY place that may read CRON_SECRET.
 *
 * **Headers only.** This used to also accept `?secret=` in the query string, which
 * put a live production credential into Vercel access logs, browser history, and
 * the Referer header of any outbound request. Vercel Cron sends
 * `Authorization: Bearer <CRON_SECRET>`; an external scheduler can send
 * `x-cron-secret`. Neither needs the URL. To trigger a job by hand, pass a header:
 *
 *     curl -H "x-cron-secret: $CRON_SECRET" https://…/api/cron/daily
 *
 * Comparison is constant-time. A `===` on a secret leaks its length and, in
 * principle, its prefix through timing — cheap to close once there is one reader.
 */
function secretsMatch(provided: string, expected: string): boolean {
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  // timingSafeEqual throws on a length mismatch, which would itself be an oracle.
  // Compare lengths in a way that still runs the full compare.
  if (a.length !== b.length) {
    timingSafeEqual(b, b); // burn equivalent time
    return false;
  }
  return timingSafeEqual(a, b);
}

export function isCronAuthorised(req: NextRequest): boolean {
  const expected = process.env.CRON_SECRET;
  if (!expected) return false; // fail closed: no secret configured → nothing is authorised

  const provided =
    req.headers.get("x-cron-secret") ??
    req.headers.get("authorization")?.replace("Bearer ", "") ??
    null;
  if (!provided) return false;

  return secretsMatch(provided, expected);
}

export function withCronRun(jobName: string, handler: CronHandler): CronHandler {
  return async (req: NextRequest): Promise<Response> => {
    if (!isCronAuthorised(req)) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const startedAt = new Date();
    let response: Response;
    let status: "completed" | "failed" = "completed";
    let errorMessage: string | null = null;
    const metadata: Record<string, number> = {};

    try {
      response = await handler(req);
      const body = (await response
        .clone()
        .json()
        .catch(() => ({}))) as Record<string, unknown>;
      const failed = typeof body.failed === "number" ? body.failed : 0;
      if (!response.ok || body.ok === false || failed > 0) {
        status = "failed";
        if (typeof body.error === "string") errorMessage = body.error;
      }
      // Extract numeric fields for metadata
      for (const [k, v] of Object.entries(body)) {
        if (typeof v === "number") metadata[k] = v;
      }
    } catch (err) {
      status = "failed";
      errorMessage = err instanceof Error ? err.message : String(err);
      response = Response.json(
        { ok: false, error: "cron handler threw" },
        { status: 500 },
      );
    }

    // Best-effort DB logging — must never mask the cron's own result
    try {
      await prisma.cronRun.create({
        data: {
          jobName,
          startedAt,
          finishedAt: new Date(),
          status,
          errorMessage,
          metadata:
            Object.keys(metadata).length > 0
              ? (metadata as Prisma.InputJsonValue)
              : undefined,
        },
      });
    } catch (e) {
      console.error(`[cron:${jobName}] failed to write cron_runs:`, e);
    }

    return response;
  };
}

/**
 * Find cron runs that started and never finished — the invisible failure.
 *
 * A `cron_runs` row is written "running" at the start and updated at the end. If the
 * function is KILLED instead of returning (the daily job has maxDuration = 120s and
 * runs twelve sequential tasks), nothing updates it: the row sits "running" forever,
 * the digest for that run is never sent, and silence is indistinguishable from a
 * clean night. The truncation reports itself as nothing at all.
 *
 * Nobody can detect that from inside the run that died, so the NEXT run looks back.
 * Anything still "running" well past the platform's own ceiling did not finish.
 *
 * Deliberately includes "daily" — unlike collectCronRunFailures below, which excludes
 * it because that function is called BY the daily job while its own row is still
 * legitimately open. Here a stale daily row is precisely what we are hunting.
 */
export async function collectStuckCronRuns(
  olderThanMinutes = 30,
): Promise<{ jobName: string; startedAt: Date; ageMinutes: number }[]> {
  const cutoff = new Date(Date.now() - olderThanMinutes * 60 * 1000);

  const stuck = await prisma.cronRun.findMany({
    where: { status: "running", startedAt: { lt: cutoff } },
    select: { jobName: true, startedAt: true },
    orderBy: { startedAt: "desc" },
    take: 20,
  });

  return stuck.map((r) => ({
    jobName: r.jobName,
    startedAt: r.startedAt,
    ageMinutes: Math.round((Date.now() - r.startedAt.getTime()) / 60000),
  }));
}

/**
 * Roll up the last N hours of cron_runs into per-job digest entries.
 * Only returns jobs that FAILED. Used by the daily orchestrator to
 * fold external cron failures into the digest.
 */
export async function collectCronRunFailures(
  sinceHours = 24,
): Promise<Record<string, CronJobDetail>> {
  const since = new Date(Date.now() - sinceHours * 3600 * 1000);

  const runs = await prisma.cronRun.findMany({
    where: {
      jobName: { not: "daily" },
      finishedAt: { gte: since },
    },
    select: {
      jobName: true,
      status: true,
      errorMessage: true,
    },
  });

  const byJob: Record<
    string,
    { total: number; failed: number; lastError?: string }
  > = {};
  for (const run of runs) {
    const agg = (byJob[run.jobName] ??= { total: 0, failed: 0 });
    agg.total++;
    if (run.status === "failed") {
      agg.failed++;
      if (run.errorMessage) agg.lastError = run.errorMessage;
    }
  }

  const detail: Record<string, CronJobDetail> = {};
  for (const [job, agg] of Object.entries(byJob)) {
    if (agg.failed === 0) continue;
    detail[job] = {
      status: "failed",
      failed: agg.failed,
      error: `${agg.failed}/${agg.total} runs failed in ${sinceHours}h${agg.lastError ? ` — ${agg.lastError}` : ""}`,
    };
  }
  return detail;
}
