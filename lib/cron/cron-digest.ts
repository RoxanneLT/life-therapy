import { sendEmail } from "@/lib/email";
import { getSiteSettings } from "@/lib/settings";
import { envOr } from "@/lib/env";

export interface CronJobDetail {
  status: string; // "ok" | "failed" | "error" | "partial" | "skipped"
  sent?: number;
  /** Work this job TRIED and could not do. Its own failure. */
  failed?: number;
  /**
   * Something this job NOTICED and is reporting — calendar drift, mostly.
   *
   * Separate from `failed` because they are different facts and were sharing a
   * word. The reconcile job returned its drift count as `failed`, so every day
   * with any drift marked the job — and the daily run that called it — as having
   * failed. 144 of its 181 runs read "failed" while working perfectly, which is
   * how the status column stopped meaning anything and a real problem could hide
   * in plain sight. Drift still raises an issue in this digest; it just no longer
   * claims the job broke.
   */
  observed?: number;
  error?: string;
  durationMs?: number;
}

export function isIssue(d: CronJobDetail): boolean {
  return (
    d.status === "failed" ||
    d.status === "error" ||
    d.status === "partial" ||
    (d.failed ?? 0) > 0 ||
    (d.observed ?? 0) > 0
  );
}

function statusGlyph(d: CronJobDetail): string {
  if (d.status === "ok") return "✓";
  if (d.status === "skipped") return "—";
  return "✗";
}

export async function sendCronDigest(
  ranAt: string,
  detail: Record<string, CronJobDetail>,
): Promise<{ emailed: boolean; issueCount: number }> {
  const issues = Object.entries(detail).filter(([, d]) => isIssue(d));
  if (issues.length === 0) return { emailed: false, issueCount: 0 }; // clean run → no email

  const settings = await getSiteSettings();
  const adminEmail =
    settings.email || envOr("ADMIN_EMAIL", "hello@life-therapy.co.za");

  const issueLines = issues
    .map(([name, d]) => {
      if ((d.failed ?? 0) > 0 && d.status !== "error" && d.status !== "failed") {
        return `  ⚠ ${name}: ${d.failed} item(s) failed (${d.sent ?? 0} ok)`;
      }
      // Named as what it is. "reconcile: 12 failed" reads as a broken job;
      // "12 item(s) need review" reads as work waiting for a person.
      if ((d.observed ?? 0) > 0 && d.status !== "error" && d.status !== "failed") {
        return `  ⚠ ${name}: ${d.observed} item(s) need review`;
      }
      return `  ✗ ${name}: ${d.status}${d.error ? ` — ${d.error}` : ""}`;
    })
    .join("\n");

  const allLines = Object.entries(detail)
    .map(([name, d]) => {
      const timing = d.durationMs != null ? ` (${d.durationMs}ms)` : "";
      const counts =
        d.sent != null || d.failed != null
          ? ` — sent ${d.sent ?? 0}, failed ${d.failed ?? 0}`
          : "";
      return `  ${statusGlyph(d)} ${name}: ${d.status}${counts}${timing}`;
    })
    .join("\n");

  try {
    await sendEmail({
      to: adminEmail,
      subject: `[Life-Therapy] daily cron — ${issues.length} issue${issues.length === 1 ? "" : "s"}`,
      html: `
        <h3>Daily Cron Report — ${new Date(ranAt).toLocaleDateString("en-ZA", { day: "numeric", month: "long", year: "numeric" })}</h3>
        <p>${issues.length} issue${issues.length === 1 ? "" : "s"} detected:</p>
        <pre style="background: #fef2f2; padding: 12px; border-radius: 6px; font-size: 13px; color: #991b1b;">${issueLines}</pre>
        <h4>Full run summary:</h4>
        <pre style="background: #f5f5f5; padding: 12px; border-radius: 6px; font-size: 13px;">${allLines}</pre>
        <p style="color: #6b7280; font-size: 12px; margin-top: 16px;">This digest is sent only when something fails. A clean run sends nothing.</p>
      `,
      templateKey: "system_notification",
      skipTracking: true,
    });
    return { emailed: true, issueCount: issues.length };
  } catch (err) {
    console.error("[cron-digest] email failed:", err);
    return { emailed: false, issueCount: issues.length };
  }
}
