"use server";

import { requireRole, getAuthenticatedAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { previewEmail } from "@/lib/email-render";
import { sendEmail } from "@/lib/email";

/**
 * Refusals are RETURNED. A thrown message is stripped in production, and every
 * refusal in this file carries the only useful information: which field is empty,
 * which template has no default, or the mail provider s own reason for rejecting
 * a test send.
 */
export async function updateTemplateAction(
  key: string,
  formData: FormData,
): Promise<{ success: boolean; error?: string }> {
  await requireRole("super_admin");

  const subject = (formData.get("subject") as string).trim();
  const bodyHtml = (formData.get("bodyHtml") as string).trim();
  const isActive = formData.get("isActive") === "true";

  if (!subject || !bodyHtml) {
    return { success: false, error: "A template needs both a subject and a body." };
  }

  await prisma.emailTemplate.update({
    where: { key },
    data: { subject, bodyHtml, isActive, updatedAt: new Date() },
  });

  revalidatePath("/admin/email-templates");
  revalidatePath(`/admin/email-templates/${key}`);
  return { success: true };
}

export async function resetTemplateAction(
  key: string,
): Promise<{ success: boolean; error?: string }> {
  await requireRole("super_admin");

  // Fetch the seed defaults from the migration — we store the original in the DB
  // For reset, we re-import the hardcoded fallback and extract its output
  const { default: defaults } = await import("@/lib/email-template-defaults");
  const templateDefault = defaults[key];

  if (!templateDefault) {
    return {
      success: false,
      error: `There is no built-in default for "${key}" to reset to — this template exists only in the database.`,
    };
  }

  await prisma.emailTemplate.update({
    where: { key },
    data: {
      subject: templateDefault.subject,
      bodyHtml: templateDefault.bodyHtml,
      isActive: true,
      updatedAt: new Date(),
    },
  });

  revalidatePath("/admin/email-templates");
  revalidatePath(`/admin/email-templates/${key}`);
  return { success: true };
}

export async function sendTestEmailAction(
  key: string,
): Promise<{ success: boolean; sentTo?: string; error?: string }> {
  await requireRole("super_admin");

  const { adminUser } = await getAuthenticatedAdmin();
  if (!adminUser?.email) {
    return {
      success: false,
      error: "Your admin account has no email address, so there is nowhere to send the test.",
    };
  }

  const { subject, html } = await previewEmail(key);

  const result = await sendEmail({
    to: adminUser.email,
    subject: `[TEST] ${subject}`,
    html,
  });

  if (!result.success) {
    // The provider's own reason — the only thing that says WHY a test send
    // failed, and previously the one thing the admin could not see.
    return {
      success: false,
      error: result.error || "The mail provider rejected the test send.",
    };
  }

  return { success: true, sentTo: adminUser.email };
}

export async function getPreviewHtml(
  key: string,
  overrides?: { subject: string; bodyHtml: string }
): Promise<{ subject: string; html: string }> {
  await requireRole("super_admin");
  return previewEmail(key, overrides);
}
