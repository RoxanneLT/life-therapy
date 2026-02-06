"use server";

import { prisma } from "@/lib/prisma";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { studentRegisterSchema } from "@/lib/validations";
import { headers } from "next/headers";
import { rateLimit } from "@/lib/rate-limit";
import { sendEmail } from "@/lib/email";
import { accountCreatedEmail } from "@/lib/email-templates";

export async function registerStudent(formData: FormData) {
  const headersList = headers();
  const ip =
    headersList.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const { success } = rateLimit(`register:${ip}`, 5, 60 * 60 * 1000);
  if (!success) {
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

  // Check if student already exists
  const existing = await prisma.student.findUnique({ where: { email } });
  if (existing) {
    return { error: "An account with this email already exists" };
  }

  // Create Supabase auth user
  const { data: authData, error: authError } =
    await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

  if (authError) {
    if (authError.message?.includes("already been registered")) {
      return { error: "An account with this email already exists" };
    }
    return { error: authError.message };
  }

  // Create Student record
  await prisma.student.create({
    data: {
      supabaseUserId: authData.user.id,
      email,
      firstName,
      lastName,
    },
  });

  // Send welcome email (non-blocking)
  const { subject, html } = accountCreatedEmail({
    firstName,
    loginUrl: "https://life-therapy.co.za/portal",
  });
  sendEmail({ to: email, subject, html }).catch((err) =>
    console.error("Failed to send welcome email:", err)
  );

  return { success: true };
}
