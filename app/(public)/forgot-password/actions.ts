"use server";

import { supabaseAdmin } from "@/lib/supabase-admin";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { prisma } from "@/lib/prisma";
import { renderEmail } from "@/lib/email-render";
import { sendEmail } from "@/lib/email";

const BASE_URL =
  process.env.NEXT_PUBLIC_BASE_URL || "https://life-therapy.online";

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
    // Step 1: Check if user exists in our students table
    const student = await prisma.student.findUnique({
      where: { email },
      select: { id: true, supabaseUserId: true, firstName: true },
    });

    if (!student) {
      console.warn(`[password-reset] No student found for ${email}`);
      // Don't reveal whether account exists
      return { success: true };
    }

    // Step 2: Ensure student is linked to a Supabase auth user
    let authUserId = student.supabaseUserId;

    if (!authUserId) {
      console.warn(`[password-reset] Student ${email} has no supabaseUserId, searching auth...`);
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
        await prisma.student.update({
          where: { id: student.id },
          data: { supabaseUserId: authMatch.id },
        });
        authUserId = authMatch.id;
        console.log(`[password-reset] Linked student to auth user ${authMatch.id}`);
      } else {
        console.warn(`[password-reset] No Supabase auth user found for ${email}`);
        return { success: true };
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

    // Build URL pointing directly to our /auth/callback (bypasses Supabase redirect)
    const actionLink = `${BASE_URL}/auth/callback?token_hash=${linkData.properties.hashed_token}&type=recovery&next=/reset-password`;

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
      studentId: student.id,
      skipTracking: true,
    });

    if (!result.success) {
      console.error(`[password-reset] sendEmail failed:`, result.error);
      return { error: "Failed to send reset email. Please try again later." };
    }

    console.log(`[password-reset] Reset email sent successfully to ${email}`);
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

  if (!newPassword) {
    return { error: "Please enter a new password." };
  }

  if (newPassword.length < 6) {
    return { error: "Password must be at least 6 characters." };
  }

  const supabase = await createSupabaseServerClient();

  const { error } = await supabase.auth.updateUser({
    password: newPassword,
  });

  if (error) {
    return { error: error.message };
  }

  return { success: true };
}
