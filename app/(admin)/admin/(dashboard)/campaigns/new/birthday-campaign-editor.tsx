"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Save, ArrowLeft, Plus, Trash2, ChevronDown, ChevronRight, Cake } from "lucide-react";
import { RichTextEditor } from "./rich-text-editor";
import Link from "next/link";
import { saveBirthdayCampaignAction } from "../actions";

export interface BirthdayEmailData {
  id?: string;
  subject: string;
  bodyHtml: string;
  ctaText: string;
  ctaUrl: string;
  genderTarget: "female" | "male" | "unknown";
}

interface BirthdayCampaignEditorProps {
  campaign?: {
    id: string;
    name: string;
    emails?: Array<{
      id: string;
      step: number;
      subject: string;
      bodyHtml: string;
      ctaText: string | null;
      ctaUrl: string | null;
      genderTarget: string | null;
    }>;
  };
}

const GENDER_TABS = [
  { key: "female" as const, label: "👩 Women", color: "bg-pink-50 text-pink-700 border-pink-200" },
  { key: "male" as const, label: "👨 Men", color: "bg-blue-50 text-blue-700 border-blue-200" },
  { key: "unknown" as const, label: "🧑 Unknown / Other", color: "bg-gray-50 text-gray-700 border-gray-200" },
] as const;

const VARIABLE_CHIPS = [{ key: "firstName", label: "First Name" }];

function getDefaultBirthdayBody(gender: "female" | "male" | "unknown"): string {
  const greeting = "Hi {{firstName}},";
  const signoff = '<p style="margin: 24px 0 0; line-height: 1.6;">With love,<br><strong>Roxanne</strong></p>';

  if (gender === "female") {
    return `<p>${greeting}</p>\n<p>Wishing you the happiest of birthdays today! 🎉</p>\n<p>I hope this year brings you everything you've been working towards — more confidence, more peace, and more moments where you feel truly proud of who you are.</p>\n<p>You deserve to celebrate yourself today.</p>\n${signoff}`;
  }
  if (gender === "male") {
    return `<p>${greeting}</p>\n<p>Happy Birthday! Hope you have a great one today.</p>\n<p>Birthdays are a good time to take stock — and when I think about the work you've put in this year, there's a lot to be proud of.</p>\n<p>Enjoy your day. You've earned it.</p>\n${signoff}`;
  }
  return `<p>${greeting}</p>\n<p>Wishing you the happiest of birthdays today!</p>\n<p>I hope this new year brings you closer to the person you're becoming — someone who knows their worth and isn't afraid to take up space in their own life.</p>\n<p>Enjoy every moment of your day.</p>\n${signoff}`;
}

export function BirthdayCampaignEditor({ campaign }: Readonly<BirthdayCampaignEditorProps>) {
  const [name, setName] = useState(campaign?.name || "Happy Birthday");
  const [activeGender, setActiveGender] = useState<"female" | "male" | "unknown">("female");
  const [saving, setSaving] = useState(false);

  // Group emails by gender
  const [emailsByGender, setEmailsByGender] = useState<Record<string, BirthdayEmailData[]>>(() => {
    const grouped: Record<string, BirthdayEmailData[]> = { female: [], male: [], unknown: [] };

    if (campaign?.emails && campaign.emails.length > 0) {
      for (const email of campaign.emails) {
        const gender = (email.genderTarget || "unknown") as "female" | "male" | "unknown";
        if (!grouped[gender]) grouped[gender] = [];
        grouped[gender].push({
          id: email.id,
          subject: email.subject,
          bodyHtml: email.bodyHtml,
          ctaText: email.ctaText || "",
          ctaUrl: email.ctaUrl || "",
          genderTarget: gender,
        });
      }
    }

    // Ensure at least 1 template per gender
    for (const gender of ["female", "male", "unknown"] as const) {
      if (grouped[gender].length === 0) {
        grouped[gender].push({
          subject: `Happy Birthday, {{firstName}}! 🎂`,
          bodyHtml: getDefaultBirthdayBody(gender),
          ctaText: "",
          ctaUrl: "",
          genderTarget: gender,
        });
      }
    }

    return grouped;
  });

  // Expanded template index per gender
  const [expandedIndex, setExpandedIndex] = useState<Record<string, number>>({
    female: 0, male: 0, unknown: 0,
  });

  // Preview
  const [previewGender, setPreviewGender] = useState<"female" | "male" | "unknown">("female");
  const [previewIndex, setPreviewIndex] = useState(0);

  const currentEmails = emailsByGender[activeGender] || [];

  function addTemplate() {
    setEmailsByGender((prev) => ({
      ...prev,
      [activeGender]: [
        ...prev[activeGender],
        {
          subject: `Happy Birthday, {{firstName}}!`,
          bodyHtml: getDefaultBirthdayBody(activeGender),
          ctaText: "",
          ctaUrl: "",
          genderTarget: activeGender,
        },
      ],
    }));
    setExpandedIndex((prev) => ({
      ...prev,
      [activeGender]: (emailsByGender[activeGender]?.length || 0),
    }));
  }

  function updateTemplate(index: number, data: Partial<BirthdayEmailData>) {
    setEmailsByGender((prev) => ({
      ...prev,
      [activeGender]: prev[activeGender].map((e, i) => (i === index ? { ...e, ...data } : e)),
    }));
  }

  function removeTemplate(index: number) {
    if (currentEmails.length <= 1) {
      toast.error("Each gender group needs at least one template.");
      return;
    }
    setEmailsByGender((prev) => ({
      ...prev,
      [activeGender]: prev[activeGender].filter((_, i) => i !== index),
    }));
    setExpandedIndex((prev) => ({
      ...prev,
      [activeGender]: Math.max(0, (prev[activeGender] || 0) - (index <= (prev[activeGender] || 0) ? 1 : 0)),
    }));
  }

  async function handleSave() {
    if (!name.trim()) {
      toast.error("Campaign name is required.");
      return;
    }

    // Validate all templates
    for (const gender of ["female", "male", "unknown"] as const) {
      const emails = emailsByGender[gender] || [];
      for (let i = 0; i < emails.length; i++) {
        if (!emails[i].subject.trim() || !emails[i].bodyHtml.trim()) {
          const genderLabel = gender === "female" ? "Women" : gender === "male" ? "Men" : "Unknown";
          toast.error(`${genderLabel} template #${i + 1}: subject and body are required.`);
          setActiveGender(gender);
          setExpandedIndex((prev) => ({ ...prev, [gender]: i }));
          return;
        }
      }
    }

    setSaving(true);
    try {
      const allEmails: BirthdayEmailData[] = [];
      for (const gender of ["female", "male", "unknown"] as const) {
        for (const email of emailsByGender[gender] || []) {
          allEmails.push({ ...email, genderTarget: gender });
        }
      }

      const formData = new FormData();
      if (campaign?.id) formData.set("id", campaign.id);
      formData.set("name", name);
      formData.set("emails", JSON.stringify(allEmails));

      await saveBirthdayCampaignAction(formData);
    } catch (err: unknown) {
      const errDigest = (err as { digest?: string })?.digest;
      if (typeof errDigest === "string" && errDigest.includes("NEXT_REDIRECT")) return;
      toast.error("Failed to save birthday campaign.");
      console.error(err);
      setSaving(false);
    }
  }

  // Preview data
  const previewEmails = emailsByGender[previewGender] || [];
  const previewEmail = previewEmails[previewIndex] || previewEmails[0];
  const previewContent = (previewEmail?.bodyHtml || "").replaceAll("{{firstName}}", "Jane");
  const previewSubject = (previewEmail?.subject || "").replaceAll("{{firstName}}", "Jane");

  const totalTemplates = Object.values(emailsByGender).reduce((acc, arr) => acc + arr.length, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Link
          href="/admin/campaigns"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Campaigns
        </Link>
        <Button onClick={handleSave} disabled={saving}>
          <Save className="mr-2 h-4 w-4" />
          {saving ? "Saving..." : "Save Birthday Campaign"}
        </Button>
      </div>

      {/* Campaign name + info */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-start gap-6">
            <div className="flex-1 space-y-2">
              <Label htmlFor="name">Campaign Name</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Happy Birthday"
              />
            </div>
            <div className="flex flex-col items-end gap-1 pt-6">
              <Badge variant="outline" className="bg-pink-50 text-pink-700 border-pink-200">
                <Cake className="mr-1 h-3 w-3" />
                {totalTemplates} templates
              </Badge>
              <p className="text-xs text-muted-foreground">
                Sends automatically on each client&apos;s birthday. Rotates templates yearly.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Left: Template editor */}
        <div className="space-y-4">
          {/* Gender tabs */}
          <div className="flex gap-1 border-b">
            {GENDER_TABS.map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveGender(tab.key)}
                className={cn(
                  "px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors",
                  activeGender === tab.key
                    ? "border-brand-600 text-brand-700"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                )}
              >
                {tab.label}
                <Badge variant="secondary" className="ml-2 text-xs">
                  {(emailsByGender[tab.key] || []).length}
                </Badge>
              </button>
            ))}
          </div>

          {/* Templates for active gender */}
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">
              {currentEmails.length} template{currentEmails.length !== 1 ? "s" : ""} — rotates with year % {currentEmails.length}
            </p>
            <Button size="sm" variant="outline" onClick={addTemplate}>
              <Plus className="mr-1.5 h-3.5 w-3.5" />
              Add Template
            </Button>
          </div>

          {currentEmails.map((email, i) => {
            const isExpanded = expandedIndex[activeGender] === i;
            return (
              <Card key={i}>
                <CardHeader
                  className="cursor-pointer py-3 px-4"
                  onClick={() => setExpandedIndex((prev) => ({
                    ...prev,
                    [activeGender]: isExpanded ? -1 : i,
                  }))}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {isExpanded ? (
                        <ChevronDown className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      )}
                      <Badge variant="outline" className="text-xs">{i + 1}</Badge>
                      <span className="text-sm font-medium truncate max-w-[280px]">
                        {email.subject || "(no subject)"}
                      </span>
                    </div>
                    {currentEmails.length > 1 && (
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 text-muted-foreground hover:text-destructive"
                        onClick={(e) => { e.stopPropagation(); removeTemplate(i); }}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                </CardHeader>
                {isExpanded && (
                  <CardContent className="space-y-4 pt-0">
                    <div className="space-y-1.5">
                      <Label>Subject Line</Label>
                      <Input
                        value={email.subject}
                        onChange={(e) => updateTemplate(i, { subject: e.target.value })}
                        placeholder="Happy Birthday, {{firstName}}!"
                      />
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs text-muted-foreground">Insert:</span>
                        {VARIABLE_CHIPS.map((v) => (
                          <Badge
                            key={v.key}
                            variant="outline"
                            className="cursor-pointer text-xs hover:bg-[#8BA889]/10 hover:border-[#8BA889]/40 transition-colors"
                            onClick={() => updateTemplate(i, { subject: email.subject + `{{${v.key}}}` })}
                          >
                            {`{{${v.key}}}`}
                          </Badge>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <Label>Email Body</Label>
                      <RichTextEditor
                        value={email.bodyHtml}
                        onChange={(html) => updateTemplate(i, { bodyHtml: html })}
                        placeholder="Write your birthday message..."
                        minHeight="220px"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label>CTA Button Text (optional)</Label>
                        <Input
                          value={email.ctaText}
                          onChange={(e) => updateTemplate(i, { ctaText: e.target.value })}
                          placeholder="e.g. Explore Your Portal"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label>CTA URL (optional)</Label>
                        <Input
                          value={email.ctaUrl}
                          onChange={(e) => updateTemplate(i, { ctaUrl: e.target.value })}
                          placeholder="e.g. /portal"
                        />
                      </div>
                    </div>
                  </CardContent>
                )}
              </Card>
            );
          })}
        </div>

        {/* Right: Preview */}
        <div className="lg:sticky lg:top-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold">Email Preview</h3>
            <div className="flex items-center gap-2">
              <select
                value={previewGender}
                onChange={(e) => { setPreviewGender(e.target.value as typeof previewGender); setPreviewIndex(0); }}
                className="rounded-md border border-input bg-background px-3 py-1.5 text-sm"
              >
                <option value="female">👩 Women</option>
                <option value="male">👨 Men</option>
                <option value="unknown">🧑 Unknown</option>
              </select>
              {previewEmails.length > 1 && (
                <select
                  value={previewIndex}
                  onChange={(e) => setPreviewIndex(Number(e.target.value))}
                  className="rounded-md border border-input bg-background px-3 py-1.5 text-sm"
                >
                  {previewEmails.map((_, i) => (
                    <option key={i} value={i}>Template {i + 1}</option>
                  ))}
                </select>
              )}
            </div>
          </div>

          <Card>
            <CardContent className="pt-4">
              <p className="mb-2 text-sm text-muted-foreground">
                Subject: <span className="font-medium text-foreground">{previewSubject || "(empty)"}</span>
              </p>
              <iframe
                srcDoc={wrapInPreview(previewContent, previewEmail?.ctaText, previewEmail?.ctaUrl)}
                className="h-[600px] w-full rounded border"
                sandbox=""
                title="Birthday Email Preview"
              />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function wrapInPreview(body: string, ctaText?: string, ctaUrl?: string): string {
  const ctaHtml = ctaText && ctaUrl
    ? `<div style="text-align: center; margin: 28px 0 8px;"><a href="${ctaUrl}" style="display: inline-block; background: #8BA889; color: #fff; padding: 12px 28px; border-radius: 6px; text-decoration: none; font-weight: 600; font-size: 14px;">${ctaText}</a></div>`
    : "";

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="font-family: 'Poppins', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #333; background-color: #f9fafb;">
  <div style="background: #fff; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
    <div style="background: #fff; padding: 24px 24px 16px; text-align: center;">
      <img src="/logo.png" alt="Life-Therapy" style="max-width: 180px; height: auto;" />
    </div>
    <div style="background: linear-gradient(135deg, #8BA889 0%, #7a9a78 100%); padding: 14px 24px; text-align: center;">
      <p style="color: rgba(255,255,255,0.9); margin: 0; font-size: 13px; letter-spacing: 0.5px;">Personal Development &amp; Life Coaching</p>
    </div>
    <div style="padding: 32px 24px;">${body}${ctaHtml}</div>
    <div style="border-top: 1px solid #e5e7eb; padding: 20px 24px; font-size: 12px; color: #6b7280; text-align: center;">
      <p style="margin: 0 0 4px;"><a href="https://life-therapy.co.za" style="color: #8BA889; text-decoration: none; font-weight: 600;">life-therapy.co.za</a></p>
      <p style="margin: 0;">hello@life-therapy.co.za</p>
      <p style="margin: 8px 0 0;"><a href="#" style="color: #9ca3af; text-decoration: underline;">Unsubscribe from marketing emails</a></p>
    </div>
  </div>
</body></html>`;
}
