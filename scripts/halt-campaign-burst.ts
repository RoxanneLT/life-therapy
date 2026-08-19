/**
 * Stop the 2026-08-19 campaign burst.
 *
 * WHAT HAPPENED. 28 clients were unpaused earlier today after the cold-contact rule was
 * found to be measuring their mail client rather than their engagement. That was right.
 * What it did NOT account for: two multi-step campaigns activated 156 days ago were still
 * `active`, and a step sends when `daysSinceActivation >= dayOffset`. For a campaign that
 * old EVERY step is already due, so the only thing pacing the sequence is how often the
 * cron runs — and `campaign_steps` runs every TWO HOURS. 68 emails went to 28 people in
 * one day; fourteen of them received three.
 *
 * WHY THIS AND NOT A CODE FIX FIRST. The pacing defect is real and needs fixing, but a fix
 * has to be written, reviewed and deployed, and the next run is at 20:00. This stops the
 * sending now, with one field the processor already honours.
 *
 * WHAT IT DOES NOT DO. It does not re-pause the clients — the unpause was correct and
 * their birthday and account mail should keep flowing. It does not touch the campaigns
 * themselves, so nothing about their configuration is lost. It sets `isPaused` on the
 * in-flight CampaignProgress rows, which is the same switch an admin uses, and every
 * change is audited so resuming is a decision someone can see rather than reconstruct.
 *
 *   npx tsx --env-file=.env.local scripts/halt-campaign-burst.ts           (dry run)
 *   npx tsx --env-file=.env.local scripts/halt-campaign-burst.ts --apply
 */
import { prisma } from "@/lib/prisma";
import { recordAudit } from "@/lib/audit";

const APPLY = process.argv.includes("--apply");

async function main() {
  const campaigns = await prisma.campaign.findMany({
    where: { status: "active", isMultiStep: true, campaignType: { not: "birthday" } },
    select: { id: true, name: true, activatedAt: true },
  });

  const targets = await prisma.campaignProgress.findMany({
    where: {
      campaignId: { in: campaigns.map((c) => c.id) },
      completedAt: null,
      isPaused: false,
    },
    select: { id: true, campaignId: true, currentStep: true, student: { select: { email: true } } },
  });

  const byCampaign = new Map(campaigns.map((c) => [c.id, c]));
  console.log(`in-flight contacts across ${campaigns.length} active campaign(s): ${targets.length}\n`);
  for (const c of campaigns) {
    const days = c.activatedAt ? Math.floor((Date.now() - c.activatedAt.getTime()) / 86400000) : null;
    const n = targets.filter((t) => t.campaignId === c.id).length;
    console.log(`  "${c.name}" — activated ${days}d ago, ${n} contact(s) to halt`);
  }

  if (!APPLY) {
    console.log(`\nDry run. Nothing written. Re-run with --apply to halt ${targets.length} contact(s).`);
    await prisma.$disconnect();
    return;
  }

  let done = 0;
  for (const t of targets) {
    await prisma.campaignProgress.update({ where: { id: t.id }, data: { isPaused: true } });
    await recordAudit({
      action: "campaign_progress_paused",
      entityType: "campaign_progress",
      entityId: t.id,
      actorEmail: "scripts/halt-campaign-burst.ts",
      before: { isPaused: false, currentStep: t.currentStep },
      after: { isPaused: true, currentStep: t.currentStep },
      metadata: {
        reason: "2026-08-19 burst: a 156-day-old campaign has every step already due, and campaign_steps runs 2-hourly, so the sequence sends at cron cadence rather than at its intended spacing.",
        campaign: byCampaign.get(t.campaignId)?.name,
        recipient: t.student?.email,
      },
    });
    done++;
  }
  console.log(`\n${done} contact(s) halted. Each has an audit_logs row.`);
  console.log(`Resume by clearing isPaused once the pacing defect is fixed.`);
  await prisma.$disconnect();
}

main();
