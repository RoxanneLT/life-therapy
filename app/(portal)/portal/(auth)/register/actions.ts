"use server";

import { prisma } from "@/lib/prisma";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { studentRegisterSchema } from "@/lib/validations";
import { headers } from "next/headers";
import { rateLimitRegisterDb } from "@/lib/rate-limit-db";
import { sendEmail } from "@/lib/email";
import { renderEmail } from "@/lib/email-render";
import { getBaseUrl } from "@/lib/get-region";


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
    email: formData.get("email") as string,
    password: formData.get("password") as string,
  };

  const parsed = studentRegisterSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message || "Invalid input" };
  }

  const { firstName, lastName, email, password } = parsed.data;

  // THIS FORM NEVER BINDS A CREDENTIAL TO AN ACCOUNT THAT ALREADY EXISTS. Nothing here proves the
  // caller owns `email`: there is no session, and `email_confirm: true` skips Supabase's own
  // confirmation. Until 2026-09-10 two branches did bind one, on knowledge of an address alone.
  // A Supabase login with no linked student (an admin's, for one) had its password overwritten
  // with whatever was typed. A student record with no login yet (from a booking, the newsletter
  // or an import) was linked to a new login with the typed password, bringing its sessions and
  // invoices with it (dev-standards/ledgers/LESSONS.md L-72: authorise a credential mint on the
  // state of the ACCOUNT). An existing account now gets a password only through Forgot
  // password, which emails a link to the address. That covers both cases: it creates and links
  // a login for a student who has none, and links an unlinked one.
  const USE_RESET =
    "We already have an account for this email. To set your password, use “Forgot password” on the sign-in page — we'll email you a secure link.";

  const existing = await prisma.student.findUnique({ where: { email } });
  if (existing) {
    if (existing.supabaseUserId) {
      // A reference to a deleted auth user is cleared, so that Forgot password can create and link
      // a new one. Clearing binds nothing: the caller still leaves with no credential.
      const { data: authCheck } = await supabaseAdmin.auth.admin.getUserById(existing.supabaseUserId);
      if (!authCheck?.user) {
        await prisma.student.update({ where: { id: existing.id }, data: { supabaseUserId: null } });
      }
    }
    return { error: USE_RESET };
  }

  // No student record: the one case where this form mints. createUser refuses an address that
  // already has a login, and that refusal is final. Never look the login up and set its password.
  const { data: authData, error: authError } =
    await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

  if (authError) {
    if (authError.message?.includes("already been registered")) {
      return { error: USE_RESET };
    }
    return { error: authError.message };
  }
  const supabaseUserId = authData.user.id;

  // The race: a booking or import can create this student between the check above and here. The
  // unique email settles it. This used to re-check and LINK the login to whatever record had
  // appeared, which is the bind this form must never make. Refusing is not enough on its own:
  // the login just created would be left unlinked, with the typed password, and Forgot password
  // links an unlinked login to its student. So the login this request created is rolled back.
  // It is milliseconds old and referenced by nothing, so this is an undo, not a hard delete.
  try {
    await prisma.student.create({
      data: {
        supabaseUserId,
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
    // Any failure, not only the race: an unlinked login carrying a typed password is exactly what
    // a later booking under this address would let Forgot password link.
    await supabaseAdmin.auth.admin.deleteUser(supabaseUserId);
    if ((err as { code?: string })?.code === "P2002") return { error: USE_RESET };
    throw err;
  }

  // Send welcome email (non-blocking)
  const baseUrl = await getBaseUrl();
  renderEmail("account_created", {
    firstName,
    loginUrl: `${baseUrl}/portal`,
  }, baseUrl).then(({ subject, html }) =>
    sendEmail({ to: email, subject, html, templateKey: "account_created" })
  ).catch((err) =>
    console.error("Failed to send welcome email:", err)
  );

  return { success: true };
}
