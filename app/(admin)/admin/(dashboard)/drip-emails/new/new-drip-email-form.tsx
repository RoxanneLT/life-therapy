"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { EmailEditor } from "@/components/admin/email/email-editor";
import type { EmailEditorData } from "@/components/admin/email/email-editor";
import { createDripEmailAction } from "../actions";

interface ExistingEmail {
  step: number;
  dayOffset: number;
  subject: string;
}

interface NewDripEmailFormProps {
  phase: string;
  existingEmails: ExistingEmail[];
}

export function NewDripEmailForm({ phase, existingEmails }: NewDripEmailFormProps) {
  const lastStep = existingEmails.length > 0 ? existingEmails[existingEmails.length - 1].step : -1;
  const lastDayOffset = existingEmails.length > 0 ? existingEmails[existingEmails.length - 1].dayOffset : 0;

  const [insertAfter, setInsertAfter] = useState(lastStep);
  const [dayOffset, setDayOffset] = useState(lastDayOffset + 14);

  function suggestDayOffset(afterStep: number) {
    if (afterStep === -1) {
      const firstOffset = existingEmails.length > 0 ? existingEmails[0].dayOffset : 0;
      return Math.max(0, firstOffset - 2);
    }
    const current = existingEmails.find((e) => e.step === afterStep);
    const next = existingEmails.find((e) => e.step === afterStep + 1);
    if (current && next) return Math.round((current.dayOffset + next.dayOffset) / 2);
    if (current) return current.dayOffset + 14;
    return 0;
  }

  function handlePositionChange(value: string) {
    const step = Number.parseInt(value, 10);
    setInsertAfter(step);
    setDayOffset(suggestDayOffset(step));
  }

  return (
    <div className="mx-auto max-w-2xl">
      <EmailEditor
        title="New Drip Email"
        subtitle={`${phase === "onboarding" ? "Onboarding" : "Newsletter"} sequence`}
        initial={{
          subject: "",
          previewText: "",
          bodyHtml: '<p style="margin: 0 0 16px; line-height: 1.6;">Hi {{firstName}},</p>\n<p style="margin: 0 0 16px; line-height: 1.6;">Your content here...</p>\n<p style="margin: 24px 0 0; line-height: 1.6;">Warmly,<br><strong>Roxanne</strong></p>',
          ctaText: "",
          ctaUrl: "",
          isActive: true,
        }}
        showCta
        showPreviewPane={false}
        showActiveToggle={false}
        showReset={false}
        saveLabel="Create Email"
        actions={{
          onSave: async (data: EmailEditorData) => {
            const formData = new FormData();
            formData.set("type", phase);
            formData.set("insertAfter", String(insertAfter));
            formData.set("dayOffset", String(dayOffset));
            formData.set("subject", data.subject);
            formData.set("previewText", data.previewText);
            formData.set("bodyHtml", data.bodyHtml);
            formData.set("ctaText", data.ctaText);
            formData.set("ctaUrl", data.ctaUrl);
            await createDripEmailAction(formData);
            return "Created!";
          },
        }}
        settingsSlot={() => (
          <>
            <div className="space-y-1.5">
              <label htmlFor="insertAfter" className="text-sm font-medium">Insert After</label>
              <select
                id="insertAfter"
                value={insertAfter}
                onChange={(e) => handlePositionChange(e.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value={-1}>At the beginning</option>
                {existingEmails.map((email) => (
                  <option key={email.step} value={email.step}>
                    Step {email.step + 1} (Day {email.dayOffset}): {email.subject.slice(0, 50)}
                    {email.subject.length > 50 ? "..." : ""}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <label htmlFor="dayOffset" className="text-sm font-medium">Day Offset</label>
              <Input
                id="dayOffset"
                type="number"
                min={0}
                value={dayOffset}
                onChange={(e) => setDayOffset(Number.parseInt(e.target.value, 10) || 0)}
              />
              <p className="text-xs text-muted-foreground">
                Contact receives this email when they&apos;ve been signed up for this many days.
              </p>
            </div>
          </>
        )}
      />
    </div>
  );
}
