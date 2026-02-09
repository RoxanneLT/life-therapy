"use client";

import { useState, useTransition } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Save } from "lucide-react";
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
  const [subject, setSubject] = useState("");
  const [previewText, setPreviewText] = useState("");
  const [bodyHtml, setBodyHtml] = useState(
    '<p style="margin: 0 0 16px; line-height: 1.6;">Hi {{firstName}},</p>\n<p style="margin: 0 0 16px; line-height: 1.6;">Your content here...</p>\n<p style="margin: 24px 0 0; line-height: 1.6;">Warmly,<br><strong>Roxanne</strong></p>'
  );
  const [ctaText, setCtaText] = useState("");
  const [ctaUrl, setCtaUrl] = useState("");
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  function suggestDayOffset(afterStep: number) {
    if (afterStep === -1) {
      // Before first email
      const firstOffset = existingEmails.length > 0 ? existingEmails[0].dayOffset : 0;
      return Math.max(0, firstOffset - 2);
    }
    const current = existingEmails.find((e) => e.step === afterStep);
    const next = existingEmails.find((e) => e.step === afterStep + 1);
    if (current && next) {
      // Midpoint between current and next
      return Math.round((current.dayOffset + next.dayOffset) / 2);
    }
    if (current) {
      // At the end — add 14 days
      return current.dayOffset + 14;
    }
    return 0;
  }

  function handlePositionChange(value: string) {
    const step = Number.parseInt(value, 10);
    setInsertAfter(step);
    setDayOffset(suggestDayOffset(step));
  }

  function handleSubmit() {
    if (!subject.trim() || !bodyHtml.trim()) {
      setError("Subject and body are required");
      return;
    }

    startTransition(async () => {
      try {
        const formData = new FormData();
        formData.set("type", phase);
        formData.set("insertAfter", String(insertAfter));
        formData.set("dayOffset", String(dayOffset));
        formData.set("subject", subject);
        formData.set("previewText", previewText);
        formData.set("bodyHtml", bodyHtml);
        formData.set("ctaText", ctaText);
        formData.set("ctaUrl", ctaUrl);
        await createDripEmailAction(formData);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to create email");
      }
    });
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      {error && (
        <p className="text-sm text-destructive">{error}</p>
      )}

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Position & Timing</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="insertAfter">Insert After</Label>
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
            <Label htmlFor="dayOffset">Day Offset (days after signup)</Label>
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
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Email Content</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="subject">Subject Line</Label>
            <Input
              id="subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="font-mono text-sm"
              placeholder="e.g. Exciting New Course Just Launched!"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="previewText">Preview Text</Label>
            <Input
              id="previewText"
              value={previewText}
              onChange={(e) => setPreviewText(e.target.value)}
              className="font-mono text-sm"
              placeholder="Shown in inbox beside the subject..."
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="bodyHtml">Body HTML</Label>
            <div className="mb-1 flex gap-1.5 text-xs text-muted-foreground">
              Available variables: <code className="rounded bg-muted px-1">{`{{firstName}}`}</code>{" "}
              <code className="rounded bg-muted px-1">{`{{unsubscribeUrl}}`}</code>
            </div>
            <Textarea
              id="bodyHtml"
              value={bodyHtml}
              onChange={(e) => setBodyHtml(e.target.value)}
              className="min-h-[300px] font-mono text-xs leading-relaxed"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Call to Action (optional)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="ctaText">Button Text</Label>
            <Input
              id="ctaText"
              value={ctaText}
              onChange={(e) => setCtaText(e.target.value)}
              placeholder="e.g. Explore the Course"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ctaUrl">Button URL</Label>
            <Input
              id="ctaUrl"
              value={ctaUrl}
              onChange={(e) => setCtaUrl(e.target.value)}
              placeholder="/courses/new-course or https://..."
              className="font-mono text-sm"
            />
          </div>
        </CardContent>
      </Card>

      <Button onClick={handleSubmit} disabled={isPending} className="gap-2">
        <Save className="h-4 w-4" />
        {isPending ? "Creating..." : "Create Email"}
      </Button>
    </div>
  );
}
