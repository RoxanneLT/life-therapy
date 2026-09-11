/**
 * The one way a password is set for someone who is not signed in: a link emailed to the account's
 * own address. Its token is spent on the reset page when they submit (`updatePasswordAction` in
 * app/(public)/forgot-password/actions.ts), and that submit is the only proof the address is theirs.
 * Forgot password and registration both come here.
 *
 * NOTHING HERE LINKS A LOGIN TO A RECORD. A student with no login gets one, created with a password
 * nobody is told, and the student row is linked to it only when the emailed token is spent, by
 * `updatePasswordAction`. Until 2026-09-11 the link was made when the email was REQUESTED, on
 * anyone's request, so a login found by address was bound to the student before anyone had proved
 * the address. Authorise a credential on the state of the account, never on knowing an address
 * (dev-standards/ledgers/LESSONS.md L-72).
 *
 * The answer never says whether an account exists; the callers show the same message either way.
 */
import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { renderEmail } from "@/lib/email-render";
import { sendEmail } from "@/lib/email";

type LinkTemplate =
  | { templateKey: "password_reset"; variables: { resetUrl: string } }
  | { templateKey: "account_created"; variables: { firstName: string; loginUrl: string } };

export type LinkResult =
  | { ok: true; sent: false }
  | { ok: true; sent: true; authUserId: string; studentId?: string }
  | { ok: false; error: string };

const GENERIC = "Something went wrong. Please try again later.";

/**
 * Email `email` a link that sets its password. `compose` turns the link into the email to send, so
 * each caller keeps its own template. `sent: false` means no account holds the address.
 */
export async function emailPasswordLink(
  email: string,
  compose: (link: string) => LinkTemplate,
  baseUrl: string,
): Promise<LinkResult> {
  // Clients live in `students`, staff in `admin_users`. Both are Supabase auth users.
  const student = await prisma.student.findUnique({
    where: { email },
    select: { id: true, supabaseUserId: true },
  });

  let authUserId = student?.supabaseUserId ?? null;
  if (!student) {
    const admin = await prisma.adminUser.findUnique({
      where: { email },
      select: { supabaseUserId: true },
    });
    if (!admin) {
      console.warn(`[account-link] No account found for ${email}`);
      return { ok: true, sent: false };
    }
    authUserId = admin.supabaseUserId;
  }

  // A reference to a deleted auth user is cleared, so a new login can be made. Clearing binds nothing.
  if (student && authUserId) {
    const { data: authCheck } = await supabaseAdmin.auth.admin.getUserById(authUserId);
    if (!authCheck?.user) {
      await prisma.student.update({ where: { id: student.id }, data: { supabaseUserId: null } });
      authUserId = null;
    }
  }

  if (!authUserId) {
    // A student with no login. Only a student reaches here: admin_users.supabaseUserId is required,
    // so an admin login is never made here. Find the login for this address, or make one. Either
    // way it is NOT linked here: the student row is linked when the emailed token is spent.
    const { data: userList, error: listError } = await supabaseAdmin.auth.admin.listUsers({
      perPage: 1000,
    });
    if (listError) {
      console.error(`[account-link] listUsers error:`, listError);
      return { ok: false, error: GENERIC };
    }
    const authMatch = userList?.users?.find((u) => u.email?.toLowerCase() === email);
    if (authMatch) {
      authUserId = authMatch.id;
    } else {
      // A password nobody is told. The only way in is the link below.
      const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email,
        password: `${randomUUID()}-${randomUUID()}`,
        email_confirm: true,
      });
      if (createError || !newUser?.user) {
        console.error(`[account-link] createUser error:`, createError);
        return { ok: false, error: GENERIC };
      }
      authUserId = newUser.user.id;
    }
  }

  const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
    type: "recovery",
    email,
  });
  if (linkError || !linkData?.properties?.hashed_token) {
    console.error(`[account-link] generateLink error:`, linkError ?? "no hashed_token");
    return { ok: false, error: GENERIC };
  }

  // Straight to the reset page, never through /auth/callback. The token is verified only when the
  // person submits a password, so a mail scanner that pre-fetches the URL cannot spend it first.
  const link = `${baseUrl}/reset-password?token_hash=${encodeURIComponent(linkData.properties.hashed_token)}&type=recovery`;

  const { templateKey, variables } = compose(link);
  const { subject, html } = await renderEmail(templateKey, variables, baseUrl);
  const result = await sendEmail({
    to: email,
    subject,
    html,
    templateKey,
    studentId: student?.id,
    skipTracking: true,
  });
  if (!result.success) {
    console.error(`[account-link] sendEmail failed:`, result.error);
    return { ok: false, error: "We couldn't send the email. Please try again later." };
  }

  return { ok: true, sent: true, authUserId, studentId: student?.id };
}
