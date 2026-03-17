/**
 * Bunny.net balance check — warns via email when balance is low.
 * Runs daily as part of the combined cron.
 * Only sends one warning per day (checks a simple in-memory flag isn't enough
 * on serverless, so we use a lightweight approach: only warn if balance < threshold).
 */

import { sendEmail } from "@/lib/email";

const LOW_BALANCE_THRESHOLD = 1.0; // USD
const WARN_EMAIL = "hello@life-therapy.co.za";

export async function checkBunnyBalance(): Promise<{ balance: number | null; warned: boolean }> {
  const key = process.env.BUNNY_ACCOUNT_API_KEY;
  if (!key) return { balance: null, warned: false };

  try {
    const res = await fetch("https://api.bunny.net/billing", {
      headers: { AccessKey: key },
    });

    if (!res.ok) {
      console.error("[bunny-check] API returned", res.status);
      return { balance: null, warned: false };
    }

    const data = await res.json();
    const balance = data.Balance as number;

    if (balance <= LOW_BALANCE_THRESHOLD) {
      console.warn(`[bunny-check] Low balance: $${balance.toFixed(2)}`);

      await sendEmail({
        to: WARN_EMAIL,
        template: "admin_new_message",
        props: {
          clientName: "System Alert",
          projectName: "Bunny.net Balance Warning",
          messagePreview: `Your Bunny.net balance is critically low at $${balance.toFixed(2)}. Video streaming and file hosting may stop working if the balance reaches $0. Please top up at https://panel.bunny.net/billing`,
          adminUrl: "https://panel.bunny.net/billing",
        },
      });

      return { balance, warned: true };
    }

    return { balance, warned: false };
  } catch (err) {
    console.error("[bunny-check] Failed:", err);
    return { balance: null, warned: false };
  }
}
