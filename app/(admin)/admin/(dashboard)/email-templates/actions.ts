"use server";

import { requireRole, getAuthenticatedAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { previewEmail } from "@/lib/email-render";
import { sendEmail } from "@/lib/email";

export async function updateTemplateAction(key: string, formData: FormData) {
  await requireRole("super_admin");

  const subject = (formData.get("subject") as string).trim();
  const bodyHtml = (formData.get("bodyHtml") as string).trim();
  const isActive = formData.get("isActive") === "true";

  if (!subject || !bodyHtml) {
    throw new Error("Subject and body are required");
  }

  await prisma.emailTemplate.update({
    where: { key },
    data: { subject, bodyHtml, isActive, updatedAt: new Date() },
  });

  revalidatePath("/admin/email-templates");
  revalidatePath(`/admin/email-templates/${key}`);
}

export async function resetTemplateAction(key: string) {
  await requireRole("super_admin");

  // Fetch the seed defaults from the migration — we store the original in the DB
  // For reset, we re-import the hardcoded fallback and extract its output
  const { default: defaults } = await import("@/lib/email-template-defaults");
  const templateDefault = defaults[key];

  if (!templateDefault) {
    throw new Error(`No default found for template: ${key}`);
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
}

export async function sendTestEmailAction(key: string) {
  await requireRole("super_admin");

  const { adminUser } = await getAuthenticatedAdmin();
  if (!adminUser?.email) {
    throw new Error("Could not determine admin email address");
  }

  const { subject, html } = await previewEmail(key);

  const result = await sendEmail({
    to: adminUser.email,
    subject: `[TEST] ${subject}`,
    html,
  });

  if (!result.success) {
    throw new Error(result.error || "Failed to send test email");
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
