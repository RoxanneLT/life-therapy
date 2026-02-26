"use client";

import { useState, useTransition, useCallback, type ReactNode } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Save, Send, RotateCcw, Eye, Code } from "lucide-react";
import { RichTextEditor } from "@/components/admin/email/rich-text-editor";
import type { VariableChip } from "@/components/admin/email/rich-text-editor";

// ── Types ──

export interface EmailEditorActions {
  /** Save the current editor state. Return a success message or throw. */
  onSave: (data: EmailEditorData) => Promise<string>;
  /** Reset to defaults. Typically reloads the page after. */
  onReset?: () => Promise<void>;
  /** Send a test email. Return "sent to …" string or throw. */
  onSendTest?: () => Promise<string>;
  /** Fetch preview HTML for the iframe. */
  onPreview?: (data: EmailEditorData) => Promise<string>;
}

export interface EmailEditorData {
  subject: string;
  previewText: string;
  bodyHtml: string;
  ctaText: string;
  ctaUrl: string;
  isActive: boolean;
}

interface EmailEditorProps {
  /** Page title */
  title: string;
  /** Subtitle / description line */
  subtitle?: string;
  /** Initial values */
  initial: EmailEditorData;
  /** Initial preview HTML (server-rendered) */
  initialPreviewHtml?: string;
  /** Callbacks for save/reset/test/preview */
  actions: EmailEditorActions;
  /** Variable chips for the rich text editor */
  variables?: VariableChip[];
  /** Extra settings fields rendered inside the Settings card, below the defaults.
   *  Receives current state + updater so slots can read/write shared state. */
  settingsSlot?: (state: EmailEditorData, update: <K extends keyof EmailEditorData>(key: K, value: EmailEditorData[K]) => void, isPending: boolean) => ReactNode;
  /** Whether to show CTA fields (default: true) */
  showCta?: boolean;
  /** Whether to show preview pane (default: true) */
  showPreviewPane?: boolean;
  /** Whether to show the active toggle (default: true) */
  showActiveToggle?: boolean;
  /** Whether to show the reset button (default: true when onReset provided) */
  showReset?: boolean;
  /** Label for the save button (default: "Save") */
  saveLabel?: string;
}

export function EmailEditor({
  title,
  subtitle,
  initial,
  initialPreviewHtml,
  actions,
  variables,
  settingsSlot,
  showCta = true,
  showPreviewPane = true,
  showActiveToggle = true,
  showReset,
  saveLabel = "Save",
}: EmailEditorProps) {
  const [state, setState] = useState<EmailEditorData>(initial);
  const [previewHtml, setPreviewHtml] = useState(initialPreviewHtml || "");
  const [showPreview, setShowPreview] = useState(!!initialPreviewHtml);
  const [saveMessage, setSaveMessage] = useState("");
  const [testMessage, setTestMessage] = useState("");
  const [isPending, startTransition] = useTransition();

  function update<K extends keyof EmailEditorData>(key: K, value: EmailEditorData[K]) {
    setState((prev) => ({ ...prev, [key]: value }));
  }

  const refreshPreview = useCallback(async () => {
    if (!actions.onPreview) return;
    try {
      const html = await actions.onPreview(state);
      setPreviewHtml(html);
    } catch {
      // Keep current preview
    }
  }, [actions, state]);

  function handleSave() {
    startTransition(async () => {
      try {
        const msg = await actions.onSave(state);
        if (actions.onPreview) await refreshPreview();
        setSaveMessage(msg || "Saved successfully!");
        setTimeout(() => setSaveMessage(""), 3000);
      } catch (err) {
        setSaveMessage(`Error: ${err instanceof Error ? err.message : "Save failed"}`);
      }
    });
  }

  function handleReset() {
    if (!actions.onReset) return;
    if (!confirm("Reset to original default? Your changes will be lost.")) return;
    startTransition(async () => {
      try {
        await actions.onReset!();
        window.location.reload();
      } catch (err) {
        setSaveMessage(`Error: ${err instanceof Error ? err.message : "Reset failed"}`);
      }
    });
  }

  function handleSendTest() {
    if (!actions.onSendTest) return;
    startTransition(async () => {
      try {
        const msg = await actions.onSendTest!();
        setTestMessage(msg);
        setTimeout(() => setTestMessage(""), 5000);
      } catch (err) {
        setTestMessage(`Error: ${err instanceof Error ? err.message : "Send failed"}`);
      }
    });
  }

  const hasReset = showReset !== undefined ? showReset : !!actions.onReset;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-heading text-2xl font-bold">{title}</h1>
          {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
        </div>
        <div className="flex items-center gap-2">
          {showPreviewPane && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowPreview(!showPreview)}
              className="gap-2"
            >
              {showPreview ? <Code className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              {showPreview ? "Editor Only" : "Show Preview"}
            </Button>
          )}
          {actions.onSendTest && (
            <Button variant="outline" size="sm" onClick={handleSendTest} disabled={isPending} className="gap-2">
              <Send className="h-4 w-4" />
              Send Test
            </Button>
          )}
          {hasReset && actions.onReset && (
            <Button variant="outline" size="sm" onClick={handleReset} disabled={isPending} className="gap-2">
              <RotateCcw className="h-4 w-4" />
              Reset
            </Button>
          )}
          <Button size="sm" onClick={handleSave} disabled={isPending} className="gap-2">
            <Save className="h-4 w-4" />
            {isPending ? "Saving..." : saveLabel}
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

      <div className={`grid gap-6 ${showPreview && showPreviewPane ? "lg:grid-cols-2" : ""}`}>
        {/* Editor column */}
        <div className="space-y-4">
          {/* Settings card */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Email Settings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {showActiveToggle && (
                <div className="flex items-center justify-between">
                  <label htmlFor="email-active" className="text-sm font-medium">Active</label>
                  <button
                    id="email-active"
                    type="button"
                    role="switch"
                    aria-checked={state.isActive}
                    onClick={() => update("isActive", !state.isActive)}
                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${state.isActive ? "bg-primary" : "bg-input"}`}
                  >
                    <span className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-background shadow-lg ring-0 transition-transform ${state.isActive ? "translate-x-5" : "translate-x-0"}`} />
                  </button>
                </div>
              )}

              {/* Custom settings slot (dayOffset, position, etc.) */}
              {settingsSlot?.(state, update, isPending)}

              <div className="space-y-1.5">
                <label htmlFor="email-subject" className="text-sm font-medium">Subject Line</label>
                <input
                  id="email-subject"
                  value={state.subject}
                  onChange={(e) => update("subject", e.target.value)}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                />
              </div>

              <div className="space-y-1.5">
                <label htmlFor="email-preview" className="text-sm font-medium">Preview Text</label>
                <input
                  id="email-preview"
                  value={state.previewText}
                  onChange={(e) => update("previewText", e.target.value)}
                  placeholder="Shown in inbox beside the subject..."
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                />
              </div>
            </CardContent>
          </Card>

          {/* CTA card */}
          {showCta && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Call to Action</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-1.5">
                  <label htmlFor="cta-text" className="text-sm font-medium">Button Text</label>
                  <input
                    id="cta-text"
                    value={state.ctaText}
                    onChange={(e) => update("ctaText", e.target.value)}
                    placeholder="e.g. Start Your Free Course"
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  />
                </div>
                <div className="space-y-1.5">
                  <label htmlFor="cta-url" className="text-sm font-medium">Button URL</label>
                  <input
                    id="cta-url"
                    value={state.ctaUrl}
                    onChange={(e) => update("ctaUrl", e.target.value)}
                    placeholder="/courses or https://..."
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  />
                </div>
              </CardContent>
            </Card>
          )}

          {/* Body card */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm">Email Body</CardTitle>
                {actions.onPreview && (
                  <Button variant="ghost" size="sm" onClick={refreshPreview} className="gap-1.5 text-xs">
                    <Eye className="h-3.5 w-3.5" />
                    Refresh Preview
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <RichTextEditor
                value={state.bodyHtml}
                onChange={(html) => update("bodyHtml", html)}
                placeholder="Start typing your email content..."
                minHeight="400px"
                variables={variables}
              />
            </CardContent>
          </Card>
        </div>

        {/* Preview column */}
        {showPreview && showPreviewPane && (
          <div className="space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm">Email Preview</CardTitle>
                  <Badge variant="outline" className="text-xs">Sample Data</Badge>
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
