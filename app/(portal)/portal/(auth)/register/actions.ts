"use server";

import { prisma } from "@/lib/prisma";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { studentRegisterSchema } from "@/lib/validations";
import { headers } from "next/headers";
import { rateLimit } from "@/lib/rate-limit";
import { sendEmail } from "@/lib/email";
import { renderEmail } from "@/lib/email-render";
import { getBaseUrl } from "@/lib/get-region";


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

  // Check if student already exists WITH auth (i.e. already has login)
  const existing = await prisma.student.findUnique({ where: { email } });
  if (existing?.supabaseUserId) {
    return { error: "An account with this email already exists" };
  }

  // Create Supabase auth user
  let supabaseUserId: string;
  const { data: authData, error: authError } =
    await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

  if (authError) {
    if (authError.message?.includes("already been registered")) {
      // Auth user exists but student isn't linked — find and link
      const { data: { users } } = await supabaseAdmin.auth.admin.listUsers();
      const authMatch = users?.find(
        (u) => u.email?.toLowerCase() === email,
      );
      if (!authMatch) {
        return { error: "An account with this email already exists" };
      }
      supabaseUserId = authMatch.id;
      // Update password since they're registering fresh
      await supabaseAdmin.auth.admin.updateUserById(supabaseUserId, {
        password,
      });
    } else {
      return { error: authError.message };
    }
  } else {
    supabaseUserId = authData.user.id;
  }

  // Link existing student record or create new one
  if (existing) {
    // Student exists from booking/newsletter/import — link to auth account
    await prisma.student.update({
      where: { id: existing.id },
      data: {
        supabaseUserId,
        firstName,
        lastName,
        source: existing.source === "newsletter" ? "website" : existing.source,
        consentGiven: true,
        consentDate: new Date(),
        consentMethod: "registration",
      },
    });
  } else {
    // Race condition guard: re-check before create
    const existingStudent = await prisma.student.findUnique({ where: { email } });
    if (existingStudent) {
      await prisma.student.update({
        where: { id: existingStudent.id },
        data: {
          supabaseUserId,
          firstName,
          lastName,
          source: existingStudent.source === "newsletter" ? "website" : existingStudent.source,
          consentGiven: true,
          consentDate: new Date(),
          consentMethod: "registration",
        },
      });
    } else {
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
    }
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
