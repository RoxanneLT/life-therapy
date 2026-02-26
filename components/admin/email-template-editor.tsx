"use client";

import { EmailEditor } from "@/components/admin/email/email-editor";
import type { EmailEditorData } from "@/components/admin/email/email-editor";
import type { VariableChip } from "@/components/admin/email/rich-text-editor";
import {
  updateTemplateAction,
  resetTemplateAction,
  sendTestEmailAction,
  getPreviewHtml,
} from "@/app/(admin)/admin/(dashboard)/email-templates/actions";

interface EmailTemplateEditorProps {
  templateKey: string;
  templateName: string;
  category: string;
  subject: string;
  bodyHtml: string;
  variables: string[];
  isActive: boolean;
  initialPreviewHtml: string;
}

const VARIABLE_DESCRIPTIONS: Record<string, string> = {
  firstName: "Client\u2019s first name",
  lastName: "Client\u2019s last name",
  fullName: "Client\u2019s full name",
  email: "Client\u2019s email address",
  unsubscribeUrl: "One-click unsubscribe link",
  passwordResetUrl: "Unique login/password setup link",
  bookingDate: "Booking date",
  bookingTime: "Booking time",
  sessionType: "Session type",
  courseName: "Course name",
  courseUrl: "Course URL",
  productName: "Product name",
  orderTotal: "Order total",
  invoiceUrl: "Invoice URL",
  portalUrl: "Portal dashboard link",
};

function buildVariableChips(variables: string[]): VariableChip[] {
  return variables.map((key) => ({
    key,
    label: key.replace(/([A-Z])/g, " $1").replace(/^./, (s) => s.toUpperCase()),
    description: VARIABLE_DESCRIPTIONS[key] || `Template variable: ${key}`,
  }));
}

export function EmailTemplateEditor({
  templateKey,
  templateName,
  category,
  subject,
  bodyHtml,
  variables,
  isActive,
  initialPreviewHtml,
}: EmailTemplateEditorProps) {
  return (
    <EmailEditor
      title={templateName}
      subtitle={`Category: ${category}`}
      initial={{
        subject,
        previewText: "",
        bodyHtml,
        ctaText: "",
        ctaUrl: "",
        isActive,
      }}
      initialPreviewHtml={initialPreviewHtml}
      showCta={false}
      variables={buildVariableChips(variables)}
      actions={{
        onSave: async (data: EmailEditorData) => {
          const formData = new FormData();
          formData.set("subject", data.subject);
          formData.set("bodyHtml", data.bodyHtml);
          formData.set("isActive", String(data.isActive));
          await updateTemplateAction(templateKey, formData);
          return "Saved successfully!";
        },
        onReset: async () => {
          await resetTemplateAction(templateKey);
        },
        onSendTest: async () => {
          const result = await sendTestEmailAction(templateKey);
          return `Test email sent to ${result.sentTo}`;
        },
        onPreview: async (data: EmailEditorData) => {
          const result = await getPreviewHtml(templateKey, {
            subject: data.subject,
            bodyHtml: data.bodyHtml,
          });
          return result.html;
        },
      }}
    />
  );
}
