"use client";

import { useState, useTransition } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { EmailEditor } from "@/components/admin/email/email-editor";
import type { EmailEditorData } from "@/components/admin/email/email-editor";
import {
  updateDripEmailAction,
  resetDripEmailAction,
  sendTestDripEmailAction,
  getDripEmailPreviewHtml,
  updateDripEmailDayOffsetAction,
} from "../actions";

interface DripEmailEditorProps {
  id: string;
  type: string;
  step: number;
  dayOffset: number;
  subject: string;
  previewText: string | null;
  bodyHtml: string;
  ctaText: string | null;
  ctaUrl: string | null;
  isActive: boolean;
  initialPreviewHtml: string;
}

export function DripEmailEditor({
  id,
  type,
  step,
  dayOffset: initialDayOffset,
  subject,
  previewText,
  bodyHtml,
  ctaText,
  ctaUrl,
  isActive,
  initialPreviewHtml,
}: DripEmailEditorProps) {
  const [dayOffset, setDayOffset] = useState(initialDayOffset);
  const [dayOffsetPending, startDayTransition] = useTransition();
  const [dayMsg, setDayMsg] = useState("");

  const typeLabel = type === "onboarding" ? "Onboarding" : "Newsletter";

  return (
    <EmailEditor
      title={`${typeLabel} #${step + 1}`}
      subtitle={`Day ${dayOffset} · ${typeLabel} Step ${step + 1}`}
      initial={{
        subject,
        previewText: previewText || "",
        bodyHtml,
        ctaText: ctaText || "",
        ctaUrl: ctaUrl || "",
        isActive,
      }}
      initialPreviewHtml={initialPreviewHtml}
      showCta
      actions={{
        onSave: async (data: EmailEditorData) => {
          const formData = new FormData();
          formData.set("subject", data.subject);
          formData.set("previewText", data.previewText);
          formData.set("bodyHtml", data.bodyHtml);
          formData.set("ctaText", data.ctaText);
          formData.set("ctaUrl", data.ctaUrl);
          formData.set("isActive", String(data.isActive));
          await updateDripEmailAction(id, formData);
          return "Saved successfully!";
        },
        onReset: async () => {
          await resetDripEmailAction(id);
        },
        onSendTest: async () => {
          const result = await sendTestDripEmailAction(id);
          return `Test email sent to ${result.sentTo}`;
        },
        onPreview: async (data: EmailEditorData) => {
          return getDripEmailPreviewHtml(
            data.bodyHtml,
            data.subject,
            data.ctaText || null,
            data.ctaUrl || null
          );
        },
      }}
      settingsSlot={(_state, _update, _isPending) => (
        <div className="space-y-1.5">
          <label htmlFor="dayOffset" className="text-sm font-medium">Day Offset</label>
          <div className="flex items-center gap-2">
            <Input
              id="dayOffset"
              type="number"
              min={0}
              value={dayOffset}
              onChange={(e) => setDayOffset(Number.parseInt(e.target.value, 10) || 0)}
              className="w-24"
            />
            <span className="text-xs text-muted-foreground">days after signup</span>
            {dayOffset !== initialDayOffset && (
              <Button
                size="sm"
                variant="outline"
                disabled={dayOffsetPending}
                onClick={() => {
                  startDayTransition(async () => {
                    try {
                      await updateDripEmailDayOffsetAction(id, dayOffset);
                      setDayMsg("Updated!");
                      setTimeout(() => setDayMsg(""), 3000);
                    } catch (err) {
                      setDayMsg(`Error: ${err instanceof Error ? err.message : "Failed"}`);
                    }
                  });
                }}
              >
                Update
              </Button>
            )}
            {dayMsg && <span className={`text-xs ${dayMsg.startsWith("Error") ? "text-destructive" : "text-green-600"}`}>{dayMsg}</span>}
          </div>
        </div>
      )}
    />
  );
}
