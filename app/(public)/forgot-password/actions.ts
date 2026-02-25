"use server";

import { createSupabaseServerClient } from "@/lib/supabase-server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { prisma } from "@/lib/prisma";
import { renderEmail } from "@/lib/email-render";
import { sendEmail } from "@/lib/email";

const BASE_URL =
  process.env.NEXT_PUBLIC_BASE_URL || "https://life-therapy.co.za";

interface ResetState {
  error?: string;
  success?: boolean;
  debug?: string;
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
    // Don't reveal — always show success
    console.log(`[password-reset] No student found for ${email}`);
    return { success: true };
  }

  // Step 2: Ensure student is linked to a Supabase auth user
  let supabaseUserId = student.supabaseUserId;

  if (!supabaseUserId) {
    // Try to find the auth user by email and auto-link
    console.log(`[password-reset] Student ${email} has no supabaseUserId, searching auth...`);
    const { data: userList } = await supabaseAdmin.auth.admin.listUsers({
      perPage: 1000,
    });
    const authMatch = userList?.users?.find(
      (u) => u.email?.toLowerCase() === email,
    );

    if (authMatch) {
      supabaseUserId = authMatch.id;
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

  // Verify auth user exists
  const { data: authUser, error: authError } =
    await supabaseAdmin.auth.admin.getUserById(supabaseUserId);

  if (authError || !authUser?.user) {
    console.log(
      `[password-reset] Auth user not found for supabaseUserId=${supabaseUserId}: ${authError?.message}`,
    );
    return { success: true };
  }

  console.log(
    `[password-reset] Found auth user: ${authUser.user.email}, id=${authUser.user.id}`,
  );

  // Step 3: Try Supabase resetPasswordForEmail (uses built-in email)
  const supabase = await createSupabaseServerClient();
  const { error: resetError } = await supabase.auth.resetPasswordForEmail(
    email,
    {
      redirectTo: `${BASE_URL}/auth/callback?next=/reset-password`,
    },
  );

  if (resetError) {
    console.log(`[password-reset] Supabase reset error: ${resetError.message}`);
  }

  // Step 4: Also send via our own Resend API as backup
  // Generate a direct password update link using admin API
  try {
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/admin/generate_link`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
          apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          type: "recovery",
          email,
          options: {
            redirect_to: `${BASE_URL}/auth/callback?next=/reset-password`,
          },
        }),
      },
    );

    if (response.ok) {
      const data = await response.json();
      const actionLink =
        data?.properties?.action_link || data?.action_link;

      if (actionLink) {
        console.log(`[password-reset] Got action link, sending via Resend`);
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
        return { success: true };
      }
    }

    const errText = await response.text();
    console.log(
      `[password-reset] generate_link failed (${response.status}): ${errText}`,
    );
  } catch (err) {
    console.log(`[password-reset] generate_link fetch error: ${err}`);
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
