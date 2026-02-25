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

  // Step 1: Check if user exists in our students table
  const student = await prisma.student.findUnique({
    where: { email },
    select: { id: true, supabaseUserId: true, firstName: true },
  });

  if (!student) {
    console.log(`[password-reset] No student found for ${email}`);
    return { success: true };
  }

  // Step 2: Ensure student is linked to a Supabase auth user
  if (!student.supabaseUserId) {
    console.log(`[password-reset] Student ${email} has no supabaseUserId, searching auth...`);
    const { data: userList } = await supabaseAdmin.auth.admin.listUsers({
      perPage: 1000,
    });
    const authMatch = userList?.users?.find(
      (u) => u.email?.toLowerCase() === email,
    );

    if (authMatch) {
      await prisma.student.update({
        where: { id: student.id },
        data: { supabaseUserId: authMatch.id },
      });
      console.log(`[password-reset] Linked student to auth user ${authMatch.id}`);
    } else {
      console.log(`[password-reset] No auth user found for ${email}`);
      return { success: true };
    }
  }

  // Step 3: Generate recovery link via admin SDK and send via Resend
  try {
    const { data: linkData, error: linkError } =
      await supabaseAdmin.auth.admin.generateLink({
        type: "recovery",
        email,
        options: {
          redirectTo: `${BASE_URL}/auth/callback?next=/reset-password`,
        },
      });

    if (linkError || !linkData?.properties?.hashed_token) {
      console.log(`[password-reset] generateLink error: ${linkError?.message}`);
      return { success: true };
    }

    // Build URL pointing directly to our /auth/callback (bypasses Supabase redirect)
    const actionLink = `${BASE_URL}/auth/callback?token_hash=${linkData.properties.hashed_token}&type=recovery&next=/reset-password`;
    console.log(`[password-reset] Got recovery link, sending via Resend`);

    const { subject, html } = await renderEmail("password_reset", {
      resetUrl: actionLink,
    });
    await sendEmail({
      to: email,
      subject,
      html,
      templateKey: "password_reset",
      studentId: student.id,
      skipTracking: true,
    });
  } catch (err) {
    console.log(`[password-reset] Error: ${err}`);
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
