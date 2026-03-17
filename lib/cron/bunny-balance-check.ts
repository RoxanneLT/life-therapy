/**
 * Bunny.net balance check — warns via email when balance is low.
 * Runs daily as part of the combined cron.
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
        subject: `⚠️ Bunny.net Balance Low: $${balance.toFixed(2)}`,
        html: `
          <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
            <h2 style="color: #b91c1c;">Bunny.net Balance Warning</h2>
            <p>Your Bunny.net balance is critically low at <strong>$${balance.toFixed(2)}</strong>.</p>
            <p>Video streaming and file hosting may stop working if the balance reaches $0.</p>
            <p><a href="https://panel.bunny.net/billing" style="display: inline-block; padding: 10px 20px; background: #8BA889; color: white; border-radius: 6px; text-decoration: none; font-weight: bold;">Top Up Now</a></p>
          </div>
        `,
      });

      return { balance, warned: true };
    }

    return { balance, warned: false };
  } catch (err) {
    console.error("[bunny-check] Failed:", err);
    return { balance: null, warned: false };
  }
}
