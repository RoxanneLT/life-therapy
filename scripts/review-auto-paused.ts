/**
 * Re-evaluate every automatically-paused client against the CURRENT engagement rule.
 *
 * Why this exists: the cold-contact rule paused a client after 5 consecutive
 * "unopened" emails, where unopened meant a tracking pixel had not loaded. Outlook
 * blocks remote images by default, so the signal measured the mail client rather
 * than the human. 65 of 181 clients were paused that way — every one by the rule,
 * not one by a person — and the pause silently stopped their campaigns, their drip
 * sequence and (until this was fixed) their birthday email.
 *
 * The rule now also counts clicks and real account activity, so a share of those 65
 * are no longer cold. This report says which, and why. It writes NOTHING: unpausing
 * a client is a judgement about a real relationship and belongs to Roxanne.
 *
 * Run: npx tsx --env-file=.env.local scripts/review-auto-paused.ts
 */
import { prisma } from "@/lib/prisma";
import { assessEngagement, isAutoPaused } from "@/lib/engagement";

async function main() {
  const paused = await prisma.student.findMany({
    where: { emailPaused: true },
    select: {
      id: true, firstName: true, lastName: true, email: true,
      clientStatus: true, emailPaused: true, emailPausedAt: true, emailPauseReason: true,
    },
    orderBy: { emailPausedAt: "asc" },
  });

  const auto = paused.filter(isAutoPaused);
  const byHand = paused.length - auto.length;

  const stillCold: string[] = [];
  const noLongerCold: { who: string; why: string; status: string }[] = [];

  for (const s of auto) {
    const verdict = await assessEngagement(s.id, s.email);
    const who = `${s.firstName} ${s.lastName} <${s.email}>`;
    if (verdict.cold) stillCold.push(who);
    else noLongerCold.push({ who, why: verdict.reason, status: s.clientStatus });
  }

  console.log(`Paused clients: ${paused.length}  (${auto.length} by the rule, ${byHand} by a person)\n`);
  console.log(`─ No longer cold under the current rule: ${noLongerCold.length} ─\n`);
  for (const r of noLongerCold.sort((a, b) => a.why.localeCompare(b.why))) {
    console.log(`  ${r.who}`);
    console.log(`      ${r.status.padEnd(10)} ${r.why}`);
  }

  console.log(`\n─ Still cold on every signal: ${stillCold.length} ─\n`);
  for (const w of stillCold) console.log(`  ${w}`);

  console.log(
    `\nNothing was changed. To resume email for a client, clear emailPaused on their record.`,
  );
  await prisma.$disconnect();
}

main();
