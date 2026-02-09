export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { notFound } from "next/navigation";
import { baseTemplate } from "@/lib/email-templates";
import { DripEmailEditor } from "./drip-email-editor";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

const DEFAULT_BASE_URL = "https://life-therapy.co.za";

export default async function DripEmailEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireRole("super_admin", "marketing");
  const { id } = await params;

  const dripEmail = await prisma.dripEmail.findUnique({
    where: { id },
  });

  if (!dripEmail) notFound();

  // Generate initial preview
  const unsubscribeUrl = `${DEFAULT_BASE_URL}/api/unsubscribe?token=preview`;

  let bodyPreview = dripEmail.bodyHtml
    .replace(/\{\{firstName\}\}/g, "Jane")
    .replace(/\{\{unsubscribeUrl\}\}/g, unsubscribeUrl);

  if (dripEmail.ctaText && dripEmail.ctaUrl) {
    const ctaUrl = dripEmail.ctaUrl.startsWith("/")
      ? `${DEFAULT_BASE_URL}${dripEmail.ctaUrl}`
      : dripEmail.ctaUrl;
    bodyPreview += `<div style="text-align: center; margin: 28px 0;"><a href="${ctaUrl}" style="display: inline-block; background: #1E4B6E; color: #fff; padding: 14px 32px; border-radius: 6px; text-decoration: none; font-weight: 600; font-size: 16px;">${dripEmail.ctaText}</a></div>`;
  }

  const subject = dripEmail.subject.replace(/\{\{firstName\}\}/g, "Jane");
  const initialPreviewHtml = baseTemplate(subject, bodyPreview, DEFAULT_BASE_URL, unsubscribeUrl);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/admin/drip-emails">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Drip Sequence
          </Link>
        </Button>
      </div>

      <DripEmailEditor
        id={dripEmail.id}
        type={dripEmail.type}
        step={dripEmail.step}
        dayOffset={dripEmail.dayOffset}
        subject={dripEmail.subject}
        previewText={dripEmail.previewText}
        bodyHtml={dripEmail.bodyHtml}
        ctaText={dripEmail.ctaText}
        ctaUrl={dripEmail.ctaUrl}
        isActive={dripEmail.isActive}
        initialPreviewHtml={initialPreviewHtml}
      />
    </div>
  );
}
