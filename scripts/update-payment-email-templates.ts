/**
 * One-time migration: update the 4 payment email DB templates to use EFT
 * banking details instead of a Paystack "Pay Now" button.
 *
 * Run once after deploying the new send-invoice.ts changes:
 *   npx tsx scripts/update-payment-email-templates.ts
 *
 * Safe to re-run — it only updates templates that still contain {{paymentUrl}}.
 */

import { PrismaClient } from "../lib/generated/prisma/client";
import defaults from "../lib/email-template-defaults";

const prisma = new PrismaClient();

const PAYMENT_KEYS = [
  "payment_request",
  "payment_request_reminder",
  "payment_request_due_today",
  "payment_request_overdue",
] as const;

async function main() {
  for (const key of PAYMENT_KEYS) {
    const template = await prisma.emailTemplate.findUnique({ where: { key } });

    if (!template) {
      console.log(`[${key}] No DB template found — fallback will be used.`);
      continue;
    }

    if (!template.bodyHtml.includes("{{paymentUrl}}")) {
      console.log(`[${key}] Already updated — skipping.`);
      continue;
    }

    const newDefault = defaults[key];
    if (!newDefault) {
      console.warn(`[${key}] No default found in email-template-defaults.ts — skipping.`);
      continue;
    }

    await prisma.emailTemplate.update({
      where: { key },
      data: {
        subject: newDefault.subject,
        bodyHtml: newDefault.bodyHtml,
      },
    });

    console.log(`[${key}] Updated successfully.`);
  }

  console.log("Done.");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
