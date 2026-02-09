"use server";

import { requireRole, getAuthenticatedAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { sendEmail } from "@/lib/email";
import { baseTemplate } from "@/lib/email-templates";

const DEFAULT_BASE_URL = "https://life-therapy.co.za";

function buildPreviewBody(
  bodyHtml: string,
  subject: string,
  ctaText?: string | null,
  ctaUrl?: string | null
) {
  const unsubscribeUrl = `${DEFAULT_BASE_URL}/api/unsubscribe?token=preview`;

  let rendered = bodyHtml
    .replace(/\{\{firstName\}\}/g, "Jane")
    .replace(/\{\{unsubscribeUrl\}\}/g, unsubscribeUrl);

  if (ctaText && ctaUrl) {
    const fullCtaUrl = ctaUrl.startsWith("/")
      ? `${DEFAULT_BASE_URL}${ctaUrl}`
      : ctaUrl;
    rendered += `<div style="text-align: center; margin: 28px 0;"><a href="${fullCtaUrl}" style="display: inline-block; background: #1E4B6E; color: #fff; padding: 14px 32px; border-radius: 6px; text-decoration: none; font-weight: 600; font-size: 16px;">${ctaText}</a></div>`;
  }

  const renderedSubject = subject.replace(/\{\{firstName\}\}/g, "Jane");
  return baseTemplate(renderedSubject, rendered, DEFAULT_BASE_URL, unsubscribeUrl);
}

export async function updateDripEmailAction(id: string, formData: FormData) {
  await requireRole("super_admin", "marketing");

  const subject = (formData.get("subject") as string).trim();
  const previewText = (formData.get("previewText") as string)?.trim() || null;
  const bodyHtml = (formData.get("bodyHtml") as string).trim();
  const ctaText = (formData.get("ctaText") as string)?.trim() || null;
  const ctaUrl = (formData.get("ctaUrl") as string)?.trim() || null;
  const isActive = formData.get("isActive") === "true";

  if (!subject || !bodyHtml) {
    throw new Error("Subject and body are required");
  }

  await prisma.dripEmail.update({
    where: { id },
    data: { subject, previewText, bodyHtml, ctaText, ctaUrl, isActive },
  });

  revalidatePath("/admin/drip-emails");
  revalidatePath(`/admin/drip-emails/${id}`);
}

export async function resetDripEmailAction(id: string) {
  await requireRole("super_admin", "marketing");

  const dripEmail = await prisma.dripEmail.findUnique({ where: { id } });
  if (!dripEmail) throw new Error("Drip email not found");

  const { default: defaults } = await import("@/lib/drip-email-defaults");
  const key = `${dripEmail.type}_${dripEmail.step}`;
  const def = defaults[key];

  if (!def) throw new Error(`No default found for: ${key}`);

  await prisma.dripEmail.update({
    where: { id },
    data: {
      subject: def.subject,
      previewText: def.previewText || null,
      bodyHtml: def.bodyHtml,
      ctaText: def.ctaText || null,
      ctaUrl: def.ctaUrl || null,
      isActive: true,
    },
  });

  revalidatePath("/admin/drip-emails");
  revalidatePath(`/admin/drip-emails/${id}`);
}

export async function toggleDripEmailActiveAction(id: string) {
  await requireRole("super_admin", "marketing");

  const dripEmail = await prisma.dripEmail.findUnique({ where: { id } });
  if (!dripEmail) throw new Error("Drip email not found");

  await prisma.dripEmail.update({
    where: { id },
    data: { isActive: !dripEmail.isActive },
  });

  revalidatePath("/admin/drip-emails");
}

export async function sendTestDripEmailAction(id: string) {
  await requireRole("super_admin", "marketing");

  const { adminUser } = await getAuthenticatedAdmin();
  if (!adminUser?.email) throw new Error("Could not determine admin email");

  const dripEmail = await prisma.dripEmail.findUnique({ where: { id } });
  if (!dripEmail) throw new Error("Drip email not found");

  const unsubscribeUrl = `${DEFAULT_BASE_URL}/api/unsubscribe?token=test-token`;

  let bodyHtml = dripEmail.bodyHtml
    .replace(/\{\{firstName\}\}/g, "Jane")
    .replace(/\{\{unsubscribeUrl\}\}/g, unsubscribeUrl);

  if (dripEmail.ctaText && dripEmail.ctaUrl) {
    const ctaUrl = dripEmail.ctaUrl.startsWith("/")
      ? `${DEFAULT_BASE_URL}${dripEmail.ctaUrl}`
      : dripEmail.ctaUrl;
    bodyHtml += `<div style="text-align: center; margin: 28px 0;"><a href="${ctaUrl}" style="display: inline-block; background: #1E4B6E; color: #fff; padding: 14px 32px; border-radius: 6px; text-decoration: none; font-weight: 600; font-size: 16px;">${dripEmail.ctaText}</a></div>`;
  }

  const subject = dripEmail.subject.replace(/\{\{firstName\}\}/g, "Jane");
  const html = baseTemplate(subject, bodyHtml, DEFAULT_BASE_URL, unsubscribeUrl);

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

export async function getDripEmailPreviewHtml(
  bodyHtml: string,
  subject: string,
  ctaText?: string | null,
  ctaUrl?: string | null
): Promise<string> {
  await requireRole("super_admin", "marketing");
  return buildPreviewBody(bodyHtml, subject, ctaText, ctaUrl);
}
