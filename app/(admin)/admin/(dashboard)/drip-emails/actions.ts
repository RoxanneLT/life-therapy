"use server";

import { requireRole, getAuthenticatedAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { sendEmail } from "@/lib/email";
import { baseTemplate } from "@/lib/email-templates";
import type { DripEmailType } from "@/lib/generated/prisma/client";

const DEFAULT_BASE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://life-therapy.co.za";

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

export async function createDripEmailAction(formData: FormData) {
  await requireRole("super_admin", "marketing");

  const type = formData.get("type") as DripEmailType;
  const insertAfter = Number.parseInt(formData.get("insertAfter") as string, 10); // -1 = at beginning
  const dayOffset = Number.parseInt(formData.get("dayOffset") as string, 10);
  const subject = (formData.get("subject") as string).trim();
  const previewText = (formData.get("previewText") as string)?.trim() || null;
  const bodyHtml = (formData.get("bodyHtml") as string).trim();
  const ctaText = (formData.get("ctaText") as string)?.trim() || null;
  const ctaUrl = (formData.get("ctaUrl") as string)?.trim() || null;

  if (!type || !subject || !bodyHtml || Number.isNaN(dayOffset)) {
    throw new Error("Type, subject, body, and day offset are required");
  }

  const newStep = insertAfter + 1;

  // Shift all subsequent steps up by 1
  const toShift = await prisma.dripEmail.findMany({
    where: { type, step: { gte: newStep } },
    orderBy: { step: "desc" },
  });

  for (const email of toShift) {
    await prisma.dripEmail.update({
      where: { id: email.id },
      data: { step: email.step + 1 },
    });
  }

  // Shift DripProgress for contacts at or past the new step
  await prisma.dripProgress.updateMany({
    where: { currentPhase: type, currentStep: { gte: newStep }, completedAt: null },
    data: { currentStep: { increment: 1 } },
  });

  // Create the new email
  const created = await prisma.dripEmail.create({
    data: { type, step: newStep, dayOffset, subject, previewText, bodyHtml, ctaText, ctaUrl },
  });

  revalidatePath("/admin/drip-emails");
  redirect(`/admin/drip-emails/${created.id}`);
}

export async function deleteDripEmailAction(id: string) {
  await requireRole("super_admin", "marketing");

  const dripEmail = await prisma.dripEmail.findUnique({ where: { id } });
  if (!dripEmail) throw new Error("Drip email not found");

  const { type, step } = dripEmail;

  // Delete the email
  await prisma.dripEmail.delete({ where: { id } });

  // Shift all subsequent steps down by 1
  const toShift = await prisma.dripEmail.findMany({
    where: { type, step: { gt: step } },
    orderBy: { step: "asc" },
  });

  for (const email of toShift) {
    await prisma.dripEmail.update({
      where: { id: email.id },
      data: { step: email.step - 1 },
    });
  }

  // Adjust DripProgress for contacts past the deleted step
  await prisma.dripProgress.updateMany({
    where: { currentPhase: type, currentStep: { gt: step }, completedAt: null },
    data: { currentStep: { decrement: 1 } },
  });

  revalidatePath("/admin/drip-emails");
}

export async function updateDripEmailDayOffsetAction(id: string, dayOffset: number) {
  await requireRole("super_admin", "marketing");

  if (Number.isNaN(dayOffset) || dayOffset < 0) {
    throw new Error("Day offset must be a non-negative number");
  }

  await prisma.dripEmail.update({
    where: { id },
    data: { dayOffset },
  });

  revalidatePath("/admin/drip-emails");
  revalidatePath(`/admin/drip-emails/${id}`);
}
