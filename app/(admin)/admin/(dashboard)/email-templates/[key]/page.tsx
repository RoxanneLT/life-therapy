export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { previewEmail } from "@/lib/email-render";
import { EmailTemplateEditor } from "@/components/admin/email-template-editor";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

export default async function EmailTemplateEditPage({
  params,
}: {
  params: Promise<{ key: string }>;
}) {
  const { key } = await params;

  const template = await prisma.emailTemplate.findUnique({
    where: { key },
  });

  if (!template) notFound();

  // Generate initial preview
  const { html: previewHtml } = await previewEmail(key);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/admin/email-templates">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Templates
          </Link>
        </Button>
      </div>

      <EmailTemplateEditor
        templateKey={template.key}
        templateName={template.name}
        category={template.category}
        subject={template.subject}
        bodyHtml={template.bodyHtml}
        variables={template.variables as string[]}
        isActive={template.isActive}
        initialPreviewHtml={previewHtml}
      />
    </div>
  );
}
