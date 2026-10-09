export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { previewEmail } from "@/lib/email-render";
import { EmailTemplateEditor } from "@/components/admin/email-template-editor";
import { BackLink } from "@/components/admin/back-link";
import { requireAccess } from "@/lib/auth";

export default async function EmailTemplateEditPage({
  params,
}: {
  params: Promise<{ key: string }>;
}) {
  await requireAccess("/admin/email-templates");
  const { key } = await params;

  const template = await prisma.emailTemplate.findUnique({
    where: { key },
  });

  if (!template) notFound();

  // Generate initial preview
  const { html: previewHtml } = await previewEmail(key);

  return (
    <div className="space-y-6">
      <BackLink href="/admin/email-templates" to="Templates" />

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
