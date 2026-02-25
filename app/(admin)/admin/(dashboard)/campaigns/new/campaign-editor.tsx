"use client";

import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { saveCampaignAction, getRecipientCountAction } from "../actions";
import { toast } from "sonner";
import { Save, Eye, ArrowLeft, Plus, ListOrdered, Mail } from "lucide-react";
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
  const [filterSource, setFilterSource] = useState(campaign?.filterSource || "");
  const [filterTags, setFilterTags] = useState(
    Array.isArray(campaign?.filterTags) ? (campaign.filterTags as string[]).join(", ") : ""
  );

  // UI state
  const [showPreview, setShowPreview] = useState(false);
  const [previewStep, setPreviewStep] = useState(0);
  const [recipientCount, setRecipientCount] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  const fetchRecipientCount = useCallback(async () => {
    try {
      const tags = filterTags.split(",").map((t) => t.trim()).filter(Boolean);
      const count = await getRecipientCountAction({
        source: filterSource || undefined,
        tags: tags.length > 0 ? tags : undefined,
      });
      setRecipientCount(count);
    } catch {
      setRecipientCount(null);
    }
  }, [filterSource, filterTags]);

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
      return;
    }

    if (isMultiStep) {
      // Validate steps
      for (let i = 0; i < steps.length; i++) {
        if (!steps[i].subject.trim() || !steps[i].bodyHtml.trim()) {
          toast.error(`Step ${i + 1}: subject and body are required.`);
          setExpandedStep(i);
          return;
        }
      }
    } else {
      if (!subject.trim() || !bodyHtml.trim()) {
        toast.error("Subject and body are required.");
        return;
      }
    }

    setSaving(true);
    try {
      const formData = new FormData();
      if (campaign?.id) formData.set("id", campaign.id);
      formData.set("name", name);
      formData.set("isMultiStep", String(isMultiStep));
      formData.set("filterSource", filterSource);
      formData.set("filterTags", filterTags);

      if (isMultiStep) {
        formData.set("emails", JSON.stringify(steps));
      } else {
        formData.set("subject", subject);
        formData.set("bodyHtml", bodyHtml);
      }

      await saveCampaignAction(formData);
      // redirect happens in server action
    } catch (err) {
      toast.error("Failed to save campaign.");
      console.error(err);
      setSaving(false);
    }
  }

  // Preview
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

  return (
    <div className="space-y-6">
      <Link
        href="/admin/campaigns"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Campaigns
      </Link>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Left: Editor */}
        <div className="space-y-4">
          {/* Campaign name + type toggle */}
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

              {/* Type toggle — only editable for new campaigns or existing drafts without sent emails */}
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

          {/* Single-email editor */}
          {!isMultiStep && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Email Content</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="subject">Subject Line</Label>
                  <Input
                    id="subject"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    placeholder="e.g. New courses available, {{firstName}}!"
                  />
                  <div className="mt-1 flex gap-1">
                    {VARIABLE_CHIPS.filter((v) => v.key === "firstName").map((v) => (
                      <Badge
                        key={v.key}
                        variant="outline"
                        className="cursor-pointer text-xs hover:bg-brand-50"
                        onClick={() => insertVariable(v.key, "subject")}
                      >
                        {`{{${v.key}}}`}
                      </Badge>
                    ))}
                  </div>
                </div>

                <div>
                  <Label htmlFor="bodyHtml">Body HTML</Label>
                  <Textarea
                    id="bodyHtml"
                    value={bodyHtml}
                    onChange={(e) => setBodyHtml(e.target.value)}
                    rows={16}
                    className="font-mono text-xs"
                  />
                  <div className="mt-1 flex gap-1">
                    {VARIABLE_CHIPS.map((v) => (
                      <Badge
                        key={v.key}
                        variant="outline"
                        className="cursor-pointer text-xs hover:bg-brand-50"
                        onClick={() => insertVariable(v.key, "body")}
                      >
                        {`{{${v.key}}}`}
                      </Badge>
                    ))}
                  </div>
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

          {/* Audience */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Audience</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="filterSource">Source Filter</Label>
                <select
                  id="filterSource"
                  value={filterSource}
                  onChange={(e) => { setFilterSource(e.target.value); setRecipientCount(null); }}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="">All Sources</option>
                  <option value="newsletter">Newsletter</option>
                  <option value="booking">Booking</option>
                  <option value="student">Student</option>
                  <option value="import">Import</option>
                  <option value="manual">Manual</option>
                </select>
              </div>

              <div>
                <Label htmlFor="filterTags">Tag Filter (comma-separated)</Label>
                <Input
                  id="filterTags"
                  value={filterTags}
                  onChange={(e) => { setFilterTags(e.target.value); setRecipientCount(null); }}
                  placeholder="e.g. vip, workshop-2026"
                />
              </div>

              <div className="flex items-center gap-3">
                <Button variant="outline" size="sm" onClick={fetchRecipientCount}>
                  Count Recipients
                </Button>
                {recipientCount !== null && (
                  <span className="text-sm font-medium">
                    {recipientCount} eligible recipient{recipientCount === 1 ? "" : "s"}
                  </span>
                )}
              </div>
            </CardContent>
          </Card>

          <div className="flex gap-2">
            <Button onClick={handleSave} disabled={saving}>
              <Save className="mr-2 h-4 w-4" />
              {saving ? "Saving..." : "Save Draft"}
            </Button>
            <Button
              variant="outline"
              onClick={() => setShowPreview(!showPreview)}
            >
              <Eye className="mr-2 h-4 w-4" />
              {showPreview ? "Hide Preview" : "Show Preview"}
            </Button>
          </div>
        </div>

        {/* Right: Preview */}
        {showPreview && (
          <Card className="lg:sticky lg:top-4">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Preview</CardTitle>
                {isMultiStep && steps.length > 1 && (
                  <select
                    value={previewStep}
                    onChange={(e) => setPreviewStep(Number(e.target.value))}
                    className="rounded-md border border-input bg-background px-2 py-1 text-xs"
                  >
                    {steps.map((s, i) => (
                      <option key={i} value={i}>
                        Step {i + 1} (Day {s.dayOffset})
                      </option>
                    ))}
                  </select>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <p className="mb-2 text-sm text-muted-foreground">
                Subject: {previewSubject}
              </p>
              <iframe
                srcDoc={wrapInBaseTemplate(previewContent)}
                className="h-[600px] w-full rounded border"
                sandbox=""
                title="Campaign Preview"
              />
            </CardContent>
          </Card>
        )}
      </div>
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

function wrapInBaseTemplate(body: string): string {
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
    </div>
    <div style="border-top: 1px solid #e5e7eb; padding: 20px 24px; font-size: 12px; color: #6b7280; text-align: center;">
      <p style="margin: 0 0 4px;"><a href="https://life-therapy.co.za" style="color: #8BA889; text-decoration: none; font-weight: 600;">life-therapy.co.za</a></p>
      <p style="margin: 0;">hello@life-therapy.co.za</p>
      <p style="margin: 8px 0 0;"><a href="{{unsubscribeUrl}}" style="color: #9ca3af; text-decoration: underline;">Unsubscribe from marketing emails</a></p>
    </div>
  </div>
</body></html>`;
}
