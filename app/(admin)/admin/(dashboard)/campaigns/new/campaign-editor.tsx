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
import { Save, Eye, ArrowLeft } from "lucide-react";
import Link from "next/link";

const VARIABLE_CHIPS = [
  { key: "firstName", label: "First Name" },
  { key: "unsubscribeUrl", label: "Unsubscribe URL" },
];

interface CampaignEditorProps {
  campaign?: {
    id: string;
    name: string;
    subject: string;
    bodyHtml: string;
    filterSource: string | null;
    filterTags: unknown;
  };
}

export function CampaignEditor({ campaign }: CampaignEditorProps) {
  const [name, setName] = useState(campaign?.name || "");
  const [subject, setSubject] = useState(campaign?.subject || "");
  const [bodyHtml, setBodyHtml] = useState(campaign?.bodyHtml || getDefaultBody());
  const [filterSource, setFilterSource] = useState(campaign?.filterSource || "");
  const [filterTags, setFilterTags] = useState(
    Array.isArray(campaign?.filterTags) ? (campaign.filterTags as string[]).join(", ") : ""
  );
  const [showPreview, setShowPreview] = useState(false);
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

  async function handleSave() {
    if (!name.trim() || !subject.trim() || !bodyHtml.trim()) {
      toast.error("Name, subject, and body are required.");
      return;
    }

    setSaving(true);
    try {
      const formData = new FormData();
      if (campaign?.id) formData.set("id", campaign.id);
      formData.set("name", name);
      formData.set("subject", subject);
      formData.set("bodyHtml", bodyHtml);
      formData.set("filterSource", filterSource);
      formData.set("filterTags", filterTags);

      await saveCampaignAction(formData);
      // redirect happens in server action
    } catch (err) {
      toast.error("Failed to save campaign.");
      console.error(err);
      setSaving(false);
    }
  }

  // Build preview HTML
  const previewHtml = bodyHtml
    .replace(/\{\{firstName\}\}/g, "Jane")
    .replace(/\{\{unsubscribeUrl\}\}/g, "#");

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
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Campaign Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="name">Campaign Name (internal)</Label>
                <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. February Newsletter" />
              </div>

              <div>
                <Label htmlFor="subject">Subject Line</Label>
                <Input id="subject" value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="e.g. New courses available, {{firstName}}!" />
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
                    {recipientCount} eligible recipient{recipientCount !== 1 ? "s" : ""}
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
              <CardTitle className="text-base">Preview</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="mb-2 text-sm text-muted-foreground">
                Subject: {subject.replace(/\{\{firstName\}\}/g, "Jane")}
              </p>
              <iframe
                srcDoc={wrapInBaseTemplate(previewHtml)}
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
      <p style="margin: 0 0 4px;"><a href="#" style="color: #8BA889; text-decoration: none; font-weight: 600;">life-therapy.co.za</a></p>
      <p style="margin: 0;">hello@life-therapy.co.za</p>
      <p style="margin: 8px 0 0;"><a href="#" style="color: #9ca3af; text-decoration: underline;">Unsubscribe from marketing emails</a></p>
    </div>
  </div>
</body></html>`;
}
