/**
 * Resume email for clients the CURRENT engagement rule no longer calls cold.
 *
 * The companion to scripts/review-auto-paused.ts, which reports and writes nothing.
 * This one writes — so it re-scores every candidate itself rather than trusting a
 * list produced earlier. A stale list is how the wrong person gets unpaused.
 *
 * What it does NOT do: touch a client paused by a person (there are none today, but
 * the rule is what protects that), touch anyone the rule still calls cold, or clear
 * `emailOptOut`. An opt-out is the client's own decision and is not ours to reverse.
 *
 * Every change writes an AuditLog row with the before/after state and the reason the
 * client is no longer cold, so this is reconstructable later.
 *
 *   --apply   perform the writes. Without it, prints exactly what it would do.
 *   --include-email <addr>   unpause this address even if it is on the hold list.
 *
 * Run: npx tsx --env-file=.env.local scripts/unpause-reviewed-clients.ts
 */
import { prisma } from "@/lib/prisma";
import { assessEngagement, isAutoPaused } from "@/lib/engagement";
import { recordAudit } from "@/lib/audit";

/**
 * Deliberately held paused, by decision rather than by rule. Roxanne is the practice
 * owner: she is auto-paused, the rule no longer calls her cold, and she has asked to
 * stay paused anyway. Recorded here rather than remembered, so a later run does not
 * quietly reverse it.
 */
const HOLD_PAUSED = new Set(["roxannebouwer@gmail.com"]);

const APPLY = process.argv.includes("--apply");
const includeIdx = process.argv.indexOf("--include-email");
const INCLUDE = includeIdx >= 0 ? process.argv[includeIdx + 1]?.toLowerCase() : null;

async function main() {
  const paused = await prisma.student.findMany({
    where: { emailPaused: true },
    select: {
      id: true, firstName: true, lastName: true, email: true,
      emailPaused: true, emailPausedAt: true, emailPauseReason: true,
    },
  });

  const toUnpause: {
    id: string;
    who: string;
    email: string;
    why: string;
    before: Record<string, unknown>;
  }[] = [];
  const held: string[] = [];
  let stillCold = 0;
  let byHand = 0;

  for (const s of paused) {
    if (!isAutoPaused(s)) { byHand++; continue; }
    const verdict = await assessEngagement(s.id, s.email);
    if (verdict.cold) { stillCold++; continue; }

    const email = s.email.toLowerCase();
    if (HOLD_PAUSED.has(email) && email !== INCLUDE) {
      held.push(`${s.firstName} ${s.lastName} <${s.email}> — held by decision`);
      continue;
    }

    toUnpause.push({
      id: s.id,
      who: `${s.firstName} ${s.lastName}`,
      email: s.email,
      why: verdict.reason,
      before: {
        emailPaused: s.emailPaused,
        emailPausedAt: s.emailPausedAt,
        emailPauseReason: s.emailPauseReason,
      },
    });
  }

  console.log(`${paused.length} paused · ${byHand} by a person · ${stillCold} still cold`);
  console.log(`${toUnpause.length} to resume${held.length ? `, ${held.length} held` : ""}\n`);
  for (const h of held) console.log(`  ⏸  ${h}`);
  for (const u of toUnpause) console.log(`  ▶  ${u.who} <${u.email}> — ${u.why}`);

  if (!APPLY) {
    console.log(`\nDry run. Nothing written. Re-run with --apply to perform ${toUnpause.length} updates.`);
    await prisma.$disconnect();
    return;
  }

  let done = 0;
  for (const u of toUnpause) {
    await prisma.student.update({
      where: { id: u.id },
      data: { emailPaused: false, emailPausedAt: null, emailPauseReason: null },
    });
    await recordAudit({
      action: "email_pause_cleared",
      entityType: "student",
      entityId: u.id,
      actorEmail: "scripts/unpause-reviewed-clients.ts",
      before: u.before,
      after: { emailPaused: false, emailPausedAt: null, emailPauseReason: null },
      metadata: {
        reason: u.why,
        note: "Auto-paused by the cold-contact rule when it read only the tracking pixel. Re-scored against clicks and account activity and found not cold.",
      },
    });
    done++;
  }
  console.log(`\n${done} client(s) resumed. Each change has an audit_logs row.`);
  await prisma.$disconnect();
}

main();
