"use server";

import { prisma } from "@/lib/prisma";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { studentRegisterSchema } from "@/lib/validations";
import { headers } from "next/headers";
import { rateLimit } from "@/lib/rate-limit";
import { sendEmail } from "@/lib/email";
import { renderEmail } from "@/lib/email-render";
import { getBaseUrl } from "@/lib/get-region";
import { upsertContact } from "@/lib/contacts";

export async function registerStudent(formData: FormData) {
  const headersList = await headers();
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
  const student = await prisma.student.create({
    data: {
      supabaseUserId: authData.user.id,
      email,
      firstName,
      lastName,
    },
  });

  // Sync to Contact list (non-blocking)
  upsertContact({
    email,
    firstName,
    lastName,
    source: "student",
    consentGiven: true,
    consentMethod: "registration",
    studentId: student.id,
  }).catch((err) => console.error("Failed to sync contact:", err));

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
