/**
 * Dormant client follow-up processor.
 *
 * Checks active clients for inactivity and:
 *   - 30 days: flags as "at risk" (admin visibility only)
 *   - 60 days: sends a gentle check-in email
 *   - 90 days: sends a stronger re-engagement email
 *
 * Tracking: uses emailLog templateKey to prevent duplicate sends.
 * Only targets clients with clientStatus "active" who have had
 * at least one completed session (not new leads).
 */

import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email";
import { renderEmail } from "@/lib/email-render";

const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL || "https://life-therapy.co.za";

export async function processDormantFollowUp(): Promise<{
  atRisk30: number;
  emailed60: number;
  emailed90: number;
}> {
  const result = { atRisk30: 0, emailed60: 0, emailed90: 0 };
  const now = new Date();

  const day30 = new Date(now);
  day30.setDate(day30.getDate() - 30);

  // Get active clients who have had at least 1 completed session
  const activeClients = await prisma.student.findMany({
    where: {
      clientStatus: "active",
      emailOptOut: false,
      emailPaused: false,
      bookings: { some: { status: "completed" } },
    },
    select: {
      id: true,
      firstName: true,
      email: true,
      unsubscribeToken: true,
      bookings: {
        where: { status: { in: ["completed", "confirmed", "pending"] } },
        orderBy: { date: "desc" },
        take: 1,
        select: { date: true, status: true },
      },
    },
  });

  for (const client of activeClients) {
    const lastSession = client.bookings[0];
    if (!lastSession) continue;

    // If they have a future/upcoming booking, they're not dormant
    if (
      lastSession.status === "confirmed" ||
      lastSession.status === "pending"
    ) {
      continue;
    }

    const lastDate = new Date(lastSession.date);
    const daysSince = Math.floor(
      (now.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24),
    );

    if (daysSince >= 90) {
      // 90-day re-engagement — dedup per client per calendar month
      const templateKey = `dormant_90d_${client.id}_${now.getFullYear()}_${now.getMonth()}`;
      const alreadySent = await prisma.emailLog.findFirst({
        where: { templateKey },
      });
      if (alreadySent) continue;

      try {
        const { subject, html } = await renderEmail(
          "dormant_90d",
          {
            firstName: client.firstName,
            daysSince: String(daysSince),
            bookUrl: `${APP_URL}/book`,
          },
          APP_URL,
          client.unsubscribeToken ?? undefined,
        );
        await sendEmail({
          to: client.email,
          subject,
          html,
          templateKey,
          studentId: client.id,
          metadata: { type: "dormant_follow_up", daysSince },
        });
        result.emailed90++;
      } catch (err) {
        console.error(
          `[dormant] 90d email failed for ${client.email}:`,
          err,
        );
      }
    } else if (daysSince >= 60) {
      // 60-day check-in — dedup per client per calendar month
      const templateKey = `dormant_60d_${client.id}_${now.getFullYear()}_${now.getMonth()}`;
      const alreadySent = await prisma.emailLog.findFirst({
        where: { templateKey },
      });
      if (alreadySent) continue;

      try {
        const { subject, html } = await renderEmail(
          "dormant_60d",
          {
            firstName: client.firstName,
            daysSince: String(daysSince),
            bookUrl: `${APP_URL}/book`,
          },
          APP_URL,
          client.unsubscribeToken ?? undefined,
        );
        await sendEmail({
          to: client.email,
          subject,
          html,
          templateKey,
          studentId: client.id,
          metadata: { type: "dormant_follow_up", daysSince },
        });
        result.emailed60++;
      } catch (err) {
        console.error(
          `[dormant] 60d email failed for ${client.email}:`,
          err,
        );
      }
    } else if (daysSince >= 30) {
      result.atRisk30++;
    }
  }

  return result;
}
