"use server";

import { headers } from "next/headers";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { prisma } from "@/lib/prisma";
import { renderEmail } from "@/lib/email-render";
import { sendEmail } from "@/lib/email";
import { recordAuthEvent } from "@/lib/audit";
import { clearRateLimit } from "@/lib/rate-limit";

function clientIp(h: Headers): string | undefined {
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || undefined;
}

const BASE_URL =
  process.env.NEXT_PUBLIC_BASE_URL || "https://life-therapy.co.za";

interface ResetState {
  error?: string;
  success?: boolean;
}

export async function requestPasswordResetAction(
  _prevState: ResetState | null,
  formData: FormData,
): Promise<ResetState> {
  const email = (formData.get("email") as string)?.trim().toLowerCase();

  if (!email) {
    return { error: "Please enter your email address." };
  }

  try {
    // Find the account — clients live in `students`, staff in `admin_users`.
    // Both are Supabase auth users, so a recovery link works for either.
    const student = await prisma.student.findUnique({
      where: { email },
      select: { id: true, supabaseUserId: true },
    });

    let authUserId = student?.supabaseUserId ?? null;
    const resolvedFor: "student" | "admin" = student ? "student" : "admin";

    if (!student) {
      const admin = await prisma.adminUser.findUnique({
        where: { email },
        select: { supabaseUserId: true },
      });
      if (!admin) {
        console.warn(`[password-reset] No account found for ${email}`);
        // Don't reveal whether an account exists.
        return { success: true };
      }
      authUserId = admin.supabaseUserId;
    }

    // Ensure the account is linked to a Supabase auth user.
    if (!authUserId) {
      console.warn(`[password-reset] ${resolvedFor} ${email} has no supabaseUserId, searching auth...`);
      const { data: userList, error: listError } = await supabaseAdmin.auth.admin.listUsers({
        perPage: 1000,
      });

      if (listError) {
        console.error(`[password-reset] listUsers error:`, listError);
        return { error: "Something went wrong. Please try again later." };
      }

      const authMatch = userList?.users?.find(
        (u) => u.email?.toLowerCase() === email,
      );

      if (authMatch) {
        authUserId = authMatch.id;
        if (resolvedFor === "student" && student) {
          await prisma.student.update({ where: { id: student.id }, data: { supabaseUserId: authMatch.id } });
        } else {
          await prisma.adminUser.update({ where: { email }, data: { supabaseUserId: authMatch.id } });
        }
        console.log(`[password-reset] Linked ${resolvedFor} to auth user ${authMatch.id}`);
      } else if (resolvedFor === "student" && student) {
        // Auto-provision a Supabase auth account for imported clients (students only —
        // never auto-create an admin auth user).
        console.log(`[password-reset] No auth user found — creating one for ${email}`);
        const tempPassword = `LT-${crypto.randomUUID().slice(0, 8)}!`;
        const { data: newUser, error: createError } =
          await supabaseAdmin.auth.admin.createUser({
            email,
            password: tempPassword,
            email_confirm: true,
          });

        if (createError || !newUser?.user) {
          console.error(`[password-reset] createUser error:`, createError);
          return { error: "Something went wrong. Please try again later." };
        }

        await prisma.student.update({
          where: { id: student.id },
          data: { supabaseUserId: newUser.user.id },
        });
        authUserId = newUser.user.id;
        console.log(`[password-reset] Created & linked auth user ${authUserId} for ${email}`);
      } else {
        console.error(`[password-reset] Admin ${email} has no linked auth user`);
        return { error: "Something went wrong. Please try again later." };
      }
    }

    // Step 3: Generate recovery link via admin SDK
    console.log(`[password-reset] Generating recovery link for ${email} (auth: ${authUserId})`);

    const { data: linkData, error: linkError } =
      await supabaseAdmin.auth.admin.generateLink({
        type: "recovery",
        email,
        options: {
          redirectTo: `${BASE_URL}/auth/callback?next=/reset-password`,
        },
      });

    if (linkError) {
      console.error(`[password-reset] generateLink error:`, linkError);
      return { error: "Something went wrong. Please try again later." };
    }

    if (!linkData?.properties?.hashed_token) {
      console.error(`[password-reset] generateLink returned no hashed_token`);
      return { error: "Something went wrong. Please try again later." };
    }

    // Point straight at the reset page (NOT /auth/callback). The token is only
    // verified when the user submits their new password, so email-link scanners
    // (e.g. Microsoft Safe Links) that pre-fetch the URL can't consume it first.
    const actionLink = `${BASE_URL}/reset-password?token_hash=${encodeURIComponent(linkData.properties.hashed_token)}&type=recovery`;

    // Step 4: Render and send email via Resend
    console.log(`[password-reset] Sending reset email to ${email}`);

    const { subject, html } = await renderEmail("password_reset", {
      resetUrl: actionLink,
    });

    const result = await sendEmail({
      to: email,
      subject,
      html,
      templateKey: "password_reset",
      studentId: student?.id,
      skipTracking: true,
    });

    if (!result.success) {
      console.error(`[password-reset] sendEmail failed:`, result.error);
      return { error: "Failed to send reset email. Please try again later." };
    }

    console.log(`[password-reset] Reset email sent successfully to ${email}`);

    await recordAuthEvent({
      action: "password_reset_requested",
      email,
      ip: clientIp(await headers()),
      userId: authUserId,
    });
  } catch (err) {
    console.error(`[password-reset] Unexpected error:`, err);
    return { error: "Something went wrong. Please try again later." };
  }

  return { success: true };
}

export async function updatePasswordAction(
  _prevState: ResetState | null,
  formData: FormData,
): Promise<ResetState> {
  const newPassword = formData.get("new_password") as string;
  const tokenHash = (formData.get("token_hash") as string) || "";

  if (!newPassword) {
    return { error: "Please enter a new password." };
  }

  if (newPassword.length < 8) {
    return { error: "Password must be at least 8 characters." };
  }

  const supabase = await createSupabaseServerClient();

  // Verify the recovery token NOW — on the user's submit, not on a GET — so an
  // email-link scanner that pre-fetched the link couldn't have consumed it first.
  // (Logged-in self-service password changes carry no token and use the session.)
  if (tokenHash) {
    const { error: verifyError } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type: "recovery",
    });
    if (verifyError) {
      console.error("[password-reset] verifyOtp failed:", verifyError.message);
      return {
        error: "This reset link has expired or already been used. Please request a new one.",
      };
    }
  }

  const { error } = await supabase.auth.updateUser({
    password: newPassword,
  });

  if (error) {
    return { error: error.message };
  }

  const h = await headers();
  const ip = clientIp(h);
  const { data: { user } } = await supabase.auth.getUser();
  await recordAuthEvent({
    action: "password_changed",
    email: user?.email ?? "unknown",
    ip,
    userId: user?.id ?? null,
  });
  // They proved account control via the email link — clear any login lockout on
  // this IP so they can sign in immediately with the new password.
  if (ip) clearRateLimit(`login:${ip}`);

  return { success: true };
}
