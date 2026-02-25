import { NextRequest, NextResponse } from "next/server";
import { processBookingReminders } from "@/lib/cron/booking-reminders";
import { processGiftDelivery } from "@/lib/cron/gift-delivery";
import { processOrderCleanup } from "@/lib/cron/order-cleanup";
import { processDripEmails } from "@/lib/drip-emails";
import { processCampaigns } from "@/lib/campaign-process";
import { processMonthlyBilling } from "@/lib/cron/monthly-billing";
import { processWhatsAppReminders } from "@/lib/cron/whatsapp-reminders";

/**
 * Combined daily cron — runs at 08:00 SAST (06:00 UTC).
 *
 * Executes all scheduled tasks sequentially. Each task is wrapped
 * in its own try/catch so a failure in one doesn't block the rest.
 *
 * Individual cron routes still exist for manual testing / local dev.
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const results: Record<string, unknown> = {};

  // 1. Order cleanup (fail stale pending orders)
  try {
    results.orderCleanup = await processOrderCleanup();
  } catch (err) {
    console.error("[daily-cron] Order cleanup failed:", err);
    results.orderCleanup = { error: String(err) };
  }

  // 2. Booking reminders (for tomorrow's sessions)
  try {
    results.bookingReminders = await processBookingReminders();
  } catch (err) {
    console.error("[daily-cron] Booking reminders failed:", err);
    results.bookingReminders = { error: String(err) };
  }

  // 3. Gift delivery (scheduled gifts ready to send)
  try {
    results.giftDelivery = await processGiftDelivery();
  } catch (err) {
    console.error("[daily-cron] Gift delivery failed:", err);
    results.giftDelivery = { error: String(err) };
  }

  // 4. Monthly billing (payment requests, reminders, overdue)
  try {
    results.monthlyBilling = await processMonthlyBilling();
  } catch (err) {
    console.error("[daily-cron] Monthly billing failed:", err);
    results.monthlyBilling = { error: String(err) };
  }

  // 5. Drip emails (automated nurture sequences)
  try {
    results.dripEmails = await processDripEmails();
  } catch (err) {
    console.error("[daily-cron] Drip emails failed:", err);
    results.dripEmails = { error: String(err) };
  }

  // 6. Campaign steps (multi-step campaign sends)
  try {
    results.campaignSteps = await processCampaigns();
  } catch (err) {
    console.error("[daily-cron] Campaign steps failed:", err);
    results.campaignSteps = { error: String(err) };
  }

  // 7. WhatsApp reminders (session, billing, credit expiry)
  try {
    results.whatsappReminders = await processWhatsAppReminders();
  } catch (err) {
    console.error("[daily-cron] WhatsApp reminders failed:", err);
    results.whatsappReminders = { error: String(err) };
  }

  return NextResponse.json({ ok: true, results });
}
