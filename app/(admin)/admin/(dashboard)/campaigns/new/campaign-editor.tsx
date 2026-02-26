"use client";

import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { saveCampaignAction, getRecipientCountAction } from "../actions";
import type { AudienceFilters } from "@/lib/audience-filters";
import { AudienceFilterBuilder } from "./audience-filter-builder";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Save, ArrowLeft, Plus, ListOrdered, Mail } from "lucide-react";
import { RichTextEditor } from "./rich-text-editor";
import Link from "next/link";
import { StepEditor, type StepData } from "./step-editor";

const VARIABLE_CHIPS = [
  { key: "firstName", label: "First Name" },
  { key: "unsubscribeUrl", label: "Unsubscribe URL" },
];

interface CampaignEditorProps {
  campaign?: {
    id: string;
    name: string;
    subject: string | null;
    bodyHtml: string | null;
    isMultiStep: boolean;
    filterSource: string | null;
    filterTags: unknown;
    emails?: Array<{
      id: string;
      step: number;
      dayOffset: number;
      subject: string;
      previewText: string | null;
      bodyHtml: string;
      ctaText: string | null;
      ctaUrl: string | null;
    }>;
  };
}

function createDefaultStep(dayOffset = 0): StepData {
  return {
    dayOffset,
    subject: "",
    previewText: "",
    bodyHtml: getDefaultStepBody(),
    ctaText: "",
    ctaUrl: "",
  };
}

export function CampaignEditor({ campaign }: Readonly<CampaignEditorProps>) {
  const [activeTab, setActiveTab] = useState<"details" | "emails">("details");
  const [name, setName] = useState(campaign?.name || "");
  const [isMultiStep, setIsMultiStep] = useState(campaign?.isMultiStep || false);

  // Single-email fields
  const [subject, setSubject] = useState(campaign?.subject || "");
  const [bodyHtml, setBodyHtml] = useState(campaign?.bodyHtml || getDefaultBody());

  // Multi-step fields
  const [steps, setSteps] = useState<StepData[]>(() => {
    if (campaign?.emails && campaign.emails.length > 0) {
      return campaign.emails
        .sort((a, b) => a.step - b.step)
        .map((e) => ({
          dayOffset: e.dayOffset,
          subject: e.subject,
          previewText: e.previewText || "",
          bodyHtml: e.bodyHtml,
          ctaText: e.ctaText || "",
          ctaUrl: e.ctaUrl || "",
        }));
    }
    return [createDefaultStep(0)];
  });
  const [expandedStep, setExpandedStep] = useState(0);

  // Audience filters
  const [audienceFilters, setAudienceFilters] = useState<AudienceFilters>(
    () => {
      const existing = (campaign as Record<string, unknown>)?.audienceFilters;
      if (existing && typeof existing === "object") return existing as AudienceFilters;
      const legacy: AudienceFilters = {};
      if (campaign?.filterSource) legacy.source = [campaign.filterSource];
      const status = (campaign as Record<string, unknown>)?.filterClientStatus as string;
      if (status) legacy.clientStatus = [status];
      if (Array.isArray(campaign?.filterTags) && (campaign.filterTags as string[]).length > 0) {
        legacy.tags = campaign.filterTags as string[];
      }
      return legacy;
    }
  );

  // UI state
  const [previewStep, setPreviewStep] = useState(0);
  const [recipientCount, setRecipientCount] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [counting, setCounting] = useState(false);

  const fetchRecipientCount = useCallback(async () => {
    try {
      setCounting(true);
      const count = await getRecipientCountAction(undefined, audienceFilters);
      setRecipientCount(count);
    } catch {
      setRecipientCount(null);
    } finally {
      setCounting(false);
    }
  }, [audienceFilters]);

  function insertVariable(variable: string, target: "subject" | "body") {
    const text = `{{${variable}}}`;
    if (target === "subject") {
      setSubject((prev) => prev + text);
    } else {
      setBodyHtml((prev) => prev + text);
    }
  }

  // Step management
  function addStep() {
    const lastStep = steps[steps.length - 1];
    const suggestedOffset = lastStep ? lastStep.dayOffset + 5 : 0;
    setSteps([...steps, createDefaultStep(suggestedOffset)]);
    setExpandedStep(steps.length);
  }

  function updateStep(index: number, data: StepData) {
    setSteps(steps.map((s, i) => (i === index ? data : s)));
  }

  function removeStep(index: number) {
    if (steps.length <= 1) return;
    const newSteps = steps.filter((_, i) => i !== index);
    setSteps(newSteps);
    if (expandedStep >= newSteps.length) {
      setExpandedStep(newSteps.length - 1);
    }
  }

  function moveStep(index: number, direction: -1 | 1) {
    const newIndex = index + direction;
    if (newIndex < 0 || newIndex >= steps.length) return;
    const newSteps = [...steps];
    [newSteps[index], newSteps[newIndex]] = [newSteps[newIndex], newSteps[index]];
    setSteps(newSteps);
    setExpandedStep(newIndex);
  }

  async function handleSave() {
    if (!name.trim()) {
      toast.error("Campaign name is required.");
      setActiveTab("details");
      return;
    }

    if (isMultiStep) {
      for (let i = 0; i < steps.length; i++) {
        if (!steps[i].subject.trim() || !steps[i].bodyHtml.trim()) {
          toast.error(`Step ${i + 1}: subject and body are required.`);
          setActiveTab("emails");
          setExpandedStep(i);
          return;
        }
      }
    } else {
      if (!subject.trim() || !bodyHtml.trim()) {
        toast.error("Subject and body are required.");
        setActiveTab("emails");
        return;
      }
    }

    setSaving(true);
    try {
      const formData = new FormData();
      if (campaign?.id) formData.set("id", campaign.id);
      formData.set("name", name);
      formData.set("isMultiStep", String(isMultiStep));
      formData.set("audienceFilters", JSON.stringify(audienceFilters));

      if (isMultiStep) {
        formData.set("emails", JSON.stringify(steps));
      } else {
        formData.set("subject", subject);
        formData.set("bodyHtml", bodyHtml);
      }

      await saveCampaignAction(formData);
    } catch (err: unknown) {
      const errDigest = (err as { digest?: string })?.digest;
      if (typeof errDigest === "string" && errDigest.includes("NEXT_REDIRECT")) return;
      toast.error("Failed to save campaign.");
      console.error(err);
      setSaving(false);
    }
  }

  // Preview content
  const previewContent = isMultiStep
    ? (steps[previewStep]?.bodyHtml || "")
        .replaceAll("{{firstName}}", "Jane")
        .replaceAll("{{unsubscribeUrl}}", "#")
    : bodyHtml
        .replaceAll("{{firstName}}", "Jane")
        .replaceAll("{{unsubscribeUrl}}", "#");

  const previewSubject = isMultiStep
    ? (steps[previewStep]?.subject || "").replaceAll("{{firstName}}", "Jane")
    : subject.replaceAll("{{firstName}}", "Jane");

  const previewCta = isMultiStep
    ? { text: steps[previewStep]?.ctaText, url: steps[previewStep]?.ctaUrl }
    : undefined;

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
          {saving ? "Saving..." : "Save Draft"}
        </Button>
      </div>

      {/* ── Tabs ── */}
      <div className="flex gap-1 border-b">
        <button
          type="button"
          onClick={() => setActiveTab("details")}
          className={cn(
            "px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors",
            activeTab === "details"
              ? "border-brand-600 text-brand-700"
              : "border-transparent text-muted-foreground hover:text-foreground"
          )}
        >
          Campaign Details & Audience
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("emails")}
          className={cn(
            "px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors",
            activeTab === "emails"
              ? "border-brand-600 text-brand-700"
              : "border-transparent text-muted-foreground hover:text-foreground"
          )}
        >
          Email Steps
          {isMultiStep && (
            <Badge variant="secondary" className="ml-2 text-xs">
              {steps.length}
            </Badge>
          )}
        </button>
      </div>

      {/* ── Tab 1: Campaign Details & Audience ── */}
      {activeTab === "details" && (
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Left column: Details */}
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Campaign Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="name">Campaign Name (internal)</Label>
                  <Input
                    id="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. February Newsletter"
                  />
                </div>

                {!campaign?.id && (
                  <div>
                    <Label className="mb-2 block">Campaign Type</Label>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant={!isMultiStep ? "default" : "outline"}
                        size="sm"
                        onClick={() => setIsMultiStep(false)}
                      >
                        <Mail className="mr-1.5 h-3.5 w-3.5" />
                        Single Email
                      </Button>
                      <Button
                        type="button"
                        variant={isMultiStep ? "default" : "outline"}
                        size="sm"
                        onClick={() => setIsMultiStep(true)}
                      >
                        <ListOrdered className="mr-1.5 h-3.5 w-3.5" />
                        Multi-Step Sequence
                      </Button>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {isMultiStep
                        ? "A sequence of emails sent over days/weeks on a schedule."
                        : "A single email sent immediately to all matching contacts."}
                    </p>
                  </div>
                )}

                {campaign?.id && (
                  <div className="flex items-center gap-2">
                    <Label>Type:</Label>
                    <Badge variant="outline">
                      {isMultiStep ? "Multi-Step Sequence" : "Single Email"}
                    </Badge>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Right column: Audience */}
          <div>
            <AudienceFilterBuilder
              filters={audienceFilters}
              onChange={(f) => { setAudienceFilters(f); setRecipientCount(null); }}
              recipientCount={recipientCount}
              onCount={fetchRecipientCount}
              counting={counting}
            />
          </div>
        </div>
      )}

      {/* ── Tab 2: Email Steps + Preview ── */}
      {activeTab === "emails" && (
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Left: Steps editor */}
          <div className="space-y-4">
            {/* Single-email editor */}
            {!isMultiStep && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Email Content</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="subject">Subject Line</Label>
                    <Input
                      id="subject"
                      value={subject}
                      onChange={(e) => setSubject(e.target.value)}
                      placeholder="e.g. New courses available, {{firstName}}!"
                    />
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs text-muted-foreground">Insert:</span>
                      {VARIABLE_CHIPS.filter((v) => v.key === "firstName").map((v) => (
                        <Badge
                          key={v.key}
                          variant="outline"
                          className="cursor-pointer text-xs hover:bg-[#8BA889]/10 hover:border-[#8BA889]/40 transition-colors"
                          onClick={() => insertVariable(v.key, "subject")}
                        >
                          {`{{${v.key}}}`}
                        </Badge>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label>Email Body</Label>
                    <RichTextEditor
                      value={bodyHtml}
                      onChange={setBodyHtml}
                      placeholder="Start typing your email content..."
                      minHeight="320px"
                    />
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Multi-step editor */}
            {isMultiStep && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold">
                    Email Steps ({steps.length})
                  </h3>
                  <Button size="sm" variant="outline" onClick={addStep}>
                    <Plus className="mr-1.5 h-3.5 w-3.5" />
                    Add Step
                  </Button>
                </div>

                {steps.map((step, i) => (
                  <StepEditor
                    key={i}
                    index={i}
                    step={step}
                    isExpanded={expandedStep === i}
                    canMoveUp={i > 0}
                    canMoveDown={i < steps.length - 1}
                    canRemove={steps.length > 1}
                    onToggle={() => setExpandedStep(expandedStep === i ? -1 : i)}
                    onChange={(data) => updateStep(i, data)}
                    onMoveUp={() => moveStep(i, -1)}
                    onMoveDown={() => moveStep(i, 1)}
                    onRemove={() => removeStep(i)}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Right: Live preview (always visible) */}
          <div className="lg:sticky lg:top-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">
                Email Preview
              </h3>
              {isMultiStep && steps.length > 1 && (
                <select
                  value={previewStep}
                  onChange={(e) => setPreviewStep(Number(e.target.value))}
                  className="rounded-md border border-input bg-background px-3 py-1.5 text-sm"
                >
                  {steps.map((s, i) => (
                    <option key={i} value={i}>
                      Step {i + 1} — Day {s.dayOffset}
                    </option>
                  ))}
                </select>
              )}
            </div>

            <Card>
              <CardContent className="pt-4">
                <p className="mb-2 text-sm text-muted-foreground">
                  Subject: <span className="font-medium text-foreground">{previewSubject || "(empty)"}</span>
                </p>
                <iframe
                  srcDoc={wrapInBaseTemplate(previewContent, previewCta)}
                  className="h-[600px] w-full rounded border"
                  sandbox=""
                  title="Campaign Preview"
                />
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}

function getDefaultBody(): string {
  return `<p>Hi {{firstName}},</p>

<p>We have some exciting news to share with you!</p>

<p>[Your content here]</p>

<p style="margin-top: 24px;">Warm regards,<br><strong>Roxanne Bouwer</strong><br>Life-Therapy</p>`;
}

function getDefaultStepBody(): string {
  return `<p>Hi {{firstName}},</p>

<p>[Your content here]</p>

<p style="margin-top: 24px;">Warm regards,<br><strong>Roxanne Bouwer</strong><br>Life-Therapy</p>`;
}

function wrapInBaseTemplate(body: string, cta?: { text?: string; url?: string }): string {
  const ctaHtml = cta?.text && cta?.url
    ? `<div style="text-align: center; margin: 28px 0 8px;">
        <a href="${cta.url}" style="display: inline-block; background: #8BA889; color: #fff; padding: 12px 28px; border-radius: 6px; text-decoration: none; font-weight: 600; font-size: 14px;">${cta.text}</a>
      </div>`
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
    <div style="padding: 32px 24px;">
      ${body}
      ${ctaHtml}
    </div>
    <div style="border-top: 1px solid #e5e7eb; padding: 20px 24px; font-size: 12px; color: #6b7280; text-align: center;">
      <p style="margin: 0 0 4px;"><a href="https://life-therapy.co.za" style="color: #8BA889; text-decoration: none; font-weight: 600;">life-therapy.co.za</a></p>
      <p style="margin: 0;">hello@life-therapy.co.za</p>
      <p style="margin: 8px 0 0;"><a href="{{unsubscribeUrl}}" style="color: #9ca3af; text-decoration: underline;">Unsubscribe from marketing emails</a></p>
    </div>
  </div>
</body></html>`;
}
