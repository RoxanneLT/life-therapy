"use client";

import { useState, useTransition, useRef, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Save,
  Send,
  RotateCcw,
  Eye,
  Code,
  Copy,
} from "lucide-react";
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

export function EmailTemplateEditor({
  templateKey,
  templateName,
  category,
  subject: initialSubject,
  bodyHtml: initialBodyHtml,
  variables,
  isActive: initialIsActive,
  initialPreviewHtml,
}: EmailTemplateEditorProps) {
  const [subject, setSubject] = useState(initialSubject);
  const [bodyHtml, setBodyHtml] = useState(initialBodyHtml);
  const [isActive, setIsActive] = useState(initialIsActive);
  const [previewHtml, setPreviewHtml] = useState(initialPreviewHtml);
  const [showPreview, setShowPreview] = useState(true);
  const [saveMessage, setSaveMessage] = useState("");
  const [testMessage, setTestMessage] = useState("");
  const [isPending, startTransition] = useTransition();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const refreshPreview = useCallback(async () => {
    try {
      const result = await getPreviewHtml(templateKey, { subject, bodyHtml });
      setPreviewHtml(result.html);
    } catch {
      // Preview failed — keep current
    }
  }, [templateKey, subject, bodyHtml]);

  function handleSave() {
    startTransition(async () => {
      try {
        const formData = new FormData();
        formData.set("subject", subject);
        formData.set("bodyHtml", bodyHtml);
        formData.set("isActive", String(isActive));
        await updateTemplateAction(templateKey, formData);
        await refreshPreview();
        setSaveMessage("Saved successfully!");
        setTimeout(() => setSaveMessage(""), 3000);
      } catch (err) {
        setSaveMessage(`Error: ${err instanceof Error ? err.message : "Save failed"}`);
      }
    });
  }

  function handleReset() {
    if (!confirm("Reset this template to its original default? Your changes will be lost.")) return;
    startTransition(async () => {
      try {
        await resetTemplateAction(templateKey);
        // Refresh the page to get the reset values
        window.location.reload();
      } catch (err) {
        setSaveMessage(`Error: ${err instanceof Error ? err.message : "Reset failed"}`);
      }
    });
  }

  function handleSendTest() {
    startTransition(async () => {
      try {
        const result = await sendTestEmailAction(templateKey);
        setTestMessage(`Test email sent to ${result.sentTo}`);
        setTimeout(() => setTestMessage(""), 5000);
      } catch (err) {
        setTestMessage(`Error: ${err instanceof Error ? err.message : "Send failed"}`);
      }
    });
  }

  function insertVariable(variable: string) {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const placeholder = `{{${variable}}}`;
    const newValue = bodyHtml.slice(0, start) + placeholder + bodyHtml.slice(end);
    setBodyHtml(newValue);

    // Restore cursor position after the inserted placeholder
    requestAnimationFrame(() => {
      textarea.focus();
      textarea.setSelectionRange(start + placeholder.length, start + placeholder.length);
    });
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-heading text-2xl font-bold">{templateName}</h1>
          <p className="text-sm text-muted-foreground capitalize">
            Category: {category}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowPreview(!showPreview)}
            className="gap-2"
          >
            {showPreview ? <Code className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
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
        <p className={`text-sm ${saveMessage.startsWith("Error") ? "text-destructive" : "text-green-600"}`}>
          {saveMessage}
        </p>
      )}
      {testMessage && (
        <p className={`text-sm ${testMessage.startsWith("Error") ? "text-destructive" : "text-green-600"}`}>
          {testMessage}
        </p>
      )}

      <div className={`grid gap-6 ${showPreview ? "lg:grid-cols-2" : ""}`}>
        {/* Editor */}
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Template Settings</CardTitle>
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
                <Label htmlFor="subject">Subject Line</Label>
                <Input
                  id="subject"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
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
                {variables.map((v) => (
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
                    title="Email Preview"
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
