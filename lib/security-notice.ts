import { renderEmail } from "@/lib/email-render";
import { sendEmail } from "@/lib/email";

/**
 * Tell an account's owner that something about their access changed: a password, their 2FA, their
 * admin role, the account itself. Shape from Pleks's lib/auth/security-notification-email.tsx.
 *
 * Until 2026-10-09 these changes wrote an audit row (lib/audit.ts) and told nobody, so a takeover
 * was noticed only by someone reading the log. The owner's inbox is the earliest alarm there is.
 *
 * Account-tier mail (lib/engagement.ts): nothing suppresses it, and it is never click-tracked,
 * because the message is about the account itself and a tracked link adds nothing to it.
 *
 * Never throws and never blocks the change it reports: the change has happened by the time this
 * runs. A failed send is logged (and lands in email_logs), never swallowed silently — the bare
 * `await` on a `{ success: false }` result is how the partner invite failed for a week (CLAUDE.md §6).
 */
export async function sendSecurityNotice(
  to: string | null | undefined,
  firstName: string | null | undefined,
  alertMessage: string,
): Promise<void> {
  if (!to) return;
  try {
    const { subject, html } = await renderEmail("security_alert", {
      firstName: firstName?.trim().split(/\s+/)[0] || "there",
      alertMessage,
    });
    const result = await sendEmail({ to, subject, html, templateKey: "security_alert", skipTracking: true });
    if (!result.success) console.error("[security-notice] send failed:", result.error);
  } catch (err) {
    console.error("[security-notice] could not send:", err);
  }
}
