"use client";

import { useState, useTransition, useRef, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Save, Send, RotateCcw, Eye, Code, Copy } from "lucide-react";
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

const VARIABLES = ["firstName", "unsubscribeUrl"];

export function DripEmailEditor({
  id,
  type,
  step,
  dayOffset,
  subject: initialSubject,
  previewText: initialPreviewText,
  bodyHtml: initialBodyHtml,
  ctaText: initialCtaText,
  ctaUrl: initialCtaUrl,
  isActive: initialIsActive,
  initialPreviewHtml,
}: DripEmailEditorProps) {
  const [currentDayOffset, setCurrentDayOffset] = useState(dayOffset);
  const [subject, setSubject] = useState(initialSubject);
  const [previewText, setPreviewText] = useState(initialPreviewText || "");
  const [bodyHtml, setBodyHtml] = useState(initialBodyHtml);
  const [ctaText, setCtaText] = useState(initialCtaText || "");
  const [ctaUrl, setCtaUrl] = useState(initialCtaUrl || "");
  const [isActive, setIsActive] = useState(initialIsActive);
  const [previewHtml, setPreviewHtml] = useState(initialPreviewHtml);
  const [showPreview, setShowPreview] = useState(true);
  const [saveMessage, setSaveMessage] = useState("");
  const [testMessage, setTestMessage] = useState("");
  const [isPending, startTransition] = useTransition();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const refreshPreview = useCallback(async () => {
    try {
      const html = await getDripEmailPreviewHtml(
        bodyHtml,
        subject,
        ctaText || null,
        ctaUrl || null
      );
      setPreviewHtml(html);
    } catch {
      // Preview failed — keep current
    }
  }, [bodyHtml, subject, ctaText, ctaUrl]);

  function handleSave() {
    startTransition(async () => {
      try {
        const formData = new FormData();
        formData.set("subject", subject);
        formData.set("previewText", previewText);
        formData.set("bodyHtml", bodyHtml);
        formData.set("ctaText", ctaText);
        formData.set("ctaUrl", ctaUrl);
        formData.set("isActive", String(isActive));
        await updateDripEmailAction(id, formData);
        await refreshPreview();
        setSaveMessage("Saved successfully!");
        setTimeout(() => setSaveMessage(""), 3000);
      } catch (err) {
        setSaveMessage(
          `Error: ${err instanceof Error ? err.message : "Save failed"}`
        );
      }
    });
  }

  function handleReset() {
    if (
      !confirm(
        "Reset this drip email to its original default? Your changes will be lost."
      )
    )
      return;
    startTransition(async () => {
      try {
        await resetDripEmailAction(id);
        window.location.reload();
      } catch (err) {
        setSaveMessage(
          `Error: ${err instanceof Error ? err.message : "Reset failed"}`
        );
      }
    });
  }

  function handleSendTest() {
    startTransition(async () => {
      try {
        const result = await sendTestDripEmailAction(id);
        setTestMessage(`Test email sent to ${result.sentTo}`);
        setTimeout(() => setTestMessage(""), 5000);
      } catch (err) {
        setTestMessage(
          `Error: ${err instanceof Error ? err.message : "Send failed"}`
        );
      }
    });
  }

  function insertVariable(variable: string) {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const placeholder = `{{${variable}}}`;
    const newValue =
      bodyHtml.slice(0, start) + placeholder + bodyHtml.slice(end);
    setBodyHtml(newValue);

    requestAnimationFrame(() => {
      textarea.focus();
      textarea.setSelectionRange(
        start + placeholder.length,
        start + placeholder.length
      );
    });
  }

  const typeLabel = type === "onboarding" ? "Onboarding" : "Newsletter";

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-heading text-2xl font-bold">
            {typeLabel} #{step + 1}
          </h1>
          <p className="text-sm text-muted-foreground">
            Day {currentDayOffset} &middot; {typeLabel} Step {step + 1}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowPreview(!showPreview)}
            className="gap-2"
          >
            {showPreview ? (
              <Code className="h-4 w-4" />
            ) : (
              <Eye className="h-4 w-4" />
            )}
            {showPreview ? "Editor Only" : "Show Preview"}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleSendTest}
            disabled={isPending}
            className="gap-2"
          >
            <Send className="h-4 w-4" />
            Send Test
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleReset}
            disabled={isPending}
            className="gap-2"
          >
            <RotateCcw className="h-4 w-4" />
            Reset
          </Button>
          <Button
            size="sm"
            onClick={handleSave}
            disabled={isPending}
            className="gap-2"
          >
            <Save className="h-4 w-4" />
            Save
          </Button>
        </div>
      </div>

      {/* Status messages */}
      {saveMessage && (
        <p
          className={`text-sm ${saveMessage.startsWith("Error") ? "text-destructive" : "text-green-600"}`}
        >
          {saveMessage}
        </p>
      )}
      {testMessage && (
        <p
          className={`text-sm ${testMessage.startsWith("Error") ? "text-destructive" : "text-green-600"}`}
        >
          {testMessage}
        </p>
      )}

      <div className={`grid gap-6 ${showPreview ? "lg:grid-cols-2" : ""}`}>
        {/* Editor */}
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Email Settings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <Label htmlFor="isActive">Active</Label>
                <Switch
                  id="isActive"
                  checked={isActive}
                  onCheckedChange={setIsActive}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="dayOffset">Day Offset</Label>
                <div className="flex items-center gap-2">
                  <Input
                    id="dayOffset"
                    type="number"
                    min={0}
                    value={currentDayOffset}
                    onChange={(e) => setCurrentDayOffset(Number.parseInt(e.target.value, 10) || 0)}
                    className="w-24"
                  />
                  <span className="text-xs text-muted-foreground">days after signup</span>
                  {currentDayOffset !== dayOffset && (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={isPending}
                      onClick={() => {
                        startTransition(async () => {
                          try {
                            await updateDripEmailDayOffsetAction(id, currentDayOffset);
                            setSaveMessage("Day offset updated!");
                            setTimeout(() => setSaveMessage(""), 3000);
                          } catch (err) {
                            setSaveMessage(`Error: ${err instanceof Error ? err.message : "Failed"}`);
                          }
                        });
                      }}
                    >
                      Update
                    </Button>
                  )}
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="subject">Subject Line</Label>
                <Input
                  id="subject"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  className="font-mono text-sm"
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
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Call to Action</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="ctaText">Button Text</Label>
                <Input
                  id="ctaText"
                  value={ctaText}
                  onChange={(e) => setCtaText(e.target.value)}
                  placeholder="e.g. Start Your Free Course"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ctaUrl">Button URL</Label>
                <Input
                  id="ctaUrl"
                  value={ctaUrl}
                  onChange={(e) => setCtaUrl(e.target.value)}
                  placeholder="/courses or https://..."
                  className="font-mono text-sm"
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm">Body HTML</CardTitle>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={refreshPreview}
                  className="gap-1.5 text-xs"
                >
                  <Eye className="h-3.5 w-3.5" />
                  Refresh Preview
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {/* Variable chips */}
              <div className="flex flex-wrap gap-1.5">
                {VARIABLES.map((v) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => insertVariable(v)}
                    className="inline-flex items-center gap-1 rounded-md border bg-muted/50 px-2 py-0.5 text-xs font-mono text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                    title={`Insert {{${v}}}`}
                  >
                    <Copy className="h-3 w-3" />
                    {`{{${v}}}`}
                  </button>
                ))}
              </div>
              <Textarea
                ref={textareaRef}
                value={bodyHtml}
                onChange={(e) => setBodyHtml(e.target.value)}
                className="min-h-[400px] font-mono text-xs leading-relaxed"
              />
            </CardContent>
          </Card>
        </div>

        {/* Preview */}
        {showPreview && (
          <div className="space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm">Email Preview</CardTitle>
                  <Badge variant="outline" className="text-xs">
                    Sample Data
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="overflow-hidden rounded-lg border bg-white">
                  <iframe
                    srcDoc={previewHtml}
                    className="h-[600px] w-full"
                    title="Drip Email Preview"
                    sandbox=""
                  />
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
