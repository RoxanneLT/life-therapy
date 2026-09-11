"use server";

import { prisma } from "@/lib/prisma";
import { studentRegisterSchema } from "@/lib/validations";
import { headers } from "next/headers";
import { after } from "next/server";
import { isRateLimitedDb, rateLimitRegisterDb, recordHitDb, limitKey } from "@/lib/rate-limit-db";
import { emailPasswordLink } from "@/lib/account-link";
import { getBaseUrl } from "@/lib/get-region";

const EMAIL_WINDOW_MS = 15 * 60 * 1000;

export async function registerStudent(formData: FormData) {
  const headersList = await headers();
  const ip =
    headersList.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  // Durable limiter — an in-memory Map is per-lambda on Vercel, so the real
  // ceiling was 5 x warm instances, resetting on every cold start.
  if (await rateLimitRegisterDb(ip)) {
    return { error: "Too many registration attempts. Please try again later." };
  }

  const raw = {
    firstName: formData.get("firstName") as string,
    lastName: formData.get("lastName") as string,
    email: (formData.get("email") as string)?.trim().toLowerCase(),
  };

  const parsed = studentRegisterSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message || "Invalid input" };
  }

  const { firstName, lastName, email } = parsed.data;

  // Registration now sends an email, so the address is throttled in the SAME bucket as Forgot
  // password's: three emails per address per fifteen minutes across both forms. Two buckets would
  // let one address be sent six by alternating the forms.
  const emailKey = limitKey("pwreset", "email", email);
  if (await isRateLimitedDb(emailKey, 3)) {
    return { error: "Too many registration attempts. Please try again later." };
  }
  await recordHitDb(emailKey, EMAIL_WINDOW_MS);

  // THIS FORM SETS NO PASSWORD, AND IT PROVES NOTHING ABOUT `email`. Until 2026-09-11 it created a
  // confirmed login holding the typed password for any address with no account yet. Records filed
  // under that address later, a booking or a gift, then belonged to whoever had registered it
  // (dev-standards/ledgers/LESSONS.md L-72: a mint on a new account is still a mint on an address).
  // Now it records the person and emails the address a link that sets the password. The link is
  // the proof, and the login is linked to the student only when it is spent (lib/account-link.ts).
  //
  // The answer is the same whether or not an account exists, so the form is not a way to ask.
  // An existing account gets the ordinary reset email instead of the welcome.
  //
  // AND IT TAKES THE SAME TIME. What happens next depends on whether the address has an account,
  // and the branches differ in cost by more than a network's jitter. So none of it runs before the
  // answer: it is handed to `after`, which runs it once the response has gone out. The cost is that
  // a failed send is no longer shown to the person, only logged. It could not be shown honestly
  // anyway, because only an existing account ever reaches the send.
  const baseUrl = await getBaseUrl();
  after(() => recordAndEmail({ email, firstName, lastName, baseUrl }));

  return { success: true };
}

async function recordAndEmail({
  email,
  firstName,
  lastName,
  baseUrl,
}: {
  email: string;
  firstName: string;
  lastName: string;
  baseUrl: string;
}) {
  const [student, admin] = await Promise.all([
    prisma.student.findUnique({ where: { email }, select: { id: true } }),
    prisma.adminUser.findUnique({ where: { email }, select: { id: true } }),
  ]);
  let isNew = !student && !admin;

  if (isNew) {
    try {
      await prisma.student.create({
        data: {
          email,
          firstName,
          lastName,
          source: "website",
          consentGiven: true,
          consentDate: new Date(),
          consentMethod: "registration",
        },
      });
    } catch (err) {
      // A booking or an import created this address in the meantime. It is an existing account now.
      if ((err as { code?: string })?.code !== "P2002") {
        console.error(`[register] student.create failed for ${email}:`, err);
        return;
      }
      isNew = false;
    }
  }

  try {
    const result = await emailPasswordLink(
      email,
      (link) =>
        isNew
          ? { templateKey: "account_created", variables: { firstName, loginUrl: link } }
          : { templateKey: "password_reset", variables: { resetUrl: link } },
      baseUrl,
    );
    if (!result.ok) console.error(`[register] no link sent to ${email}: ${result.error}`);
  } catch (err) {
    console.error(`[register] emailPasswordLink threw for ${email}:`, err);
  }
}
