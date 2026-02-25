"use client";

import { useState, useEffect, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  MessageSquare,
  Bell,
  Send,
  CheckCircle2,
  XCircle,
  ChevronLeft,
  ChevronRight,
  Pencil,
  Save,
  X,
  Link2,
  Loader2,
} from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import {
  updateWhatsAppSettingsAction,
  sendTestWhatsAppAction,
  getWhatsAppLogsAction,
  getWhatsAppTemplatesAction,
  updateWhatsAppTemplateAction,
} from "./whatsapp-actions";
import type { SiteSetting } from "@/lib/generated/prisma/client";
import { cn } from "@/lib/utils";

// ─── Types ───────────────────────────────────────────────────

interface LogEntry {
  id: string;
  templateName: string;
  to: string;
  studentName: string | null;
  status: string;
  error: string | null;
  sentAt: string;
}

interface TemplateEntry {
  id: string;
  name: string;
  bodyText: string;
  description: string | null;
}

interface WhatsAppPanelProps {
  initialSettings: SiteSetting;
  whatsappTokenSet: boolean;
}

const SECTIONS = [
  { id: "connection", label: "Connection", icon: Link2 },
  { id: "reminders", label: "Reminders", icon: Bell },
  { id: "templates", label: "Templates", icon: Send },
  { id: "log", label: "Message Log", icon: MessageSquare },
] as const;

type SectionId = (typeof SECTIONS)[number]["id"];

// ─── Main Component ──────────────────────────────────────────

export function WhatsAppPanel({
  initialSettings,
  whatsappTokenSet,
}: WhatsAppPanelProps) {
  const s = initialSettings;
  const [isPending, startTransition] = useTransition();
  const [activeSection, setActiveSection] = useState<SectionId>("connection");

  // Connection state
  const [enabled, setEnabled] = useState(s.whatsappEnabled);
  const [phoneNumberId, setPhoneNumberId] = useState(s.whatsappPhoneNumberId || "");
  const [businessAccountId, setBusinessAccountId] = useState(s.whatsappBusinessAccountId || "");

  // Reminder toggles
  const [sessionReminders, setSessionReminders] = useState(s.whatsappSessionReminders);
  const [billingReminders, setBillingReminders] = useState(s.whatsappBillingReminders);
  const [creditReminders, setCreditReminders] = useState(s.whatsappCreditReminders);
  const [creditExpiryDays, setCreditExpiryDays] = useState(s.creditExpiryDays?.toString() || "");

  // Test message
  const [testPhone, setTestPhone] = useState("");

  // Message log
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [logPage, setLogPage] = useState(1);
  const [logPages, setLogPages] = useState(0);
  const [logTotal, setLogTotal] = useState(0);

  // Templates
  const [templates, setTemplates] = useState<TemplateEntry[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editBody, setEditBody] = useState("");
  const [editDesc, setEditDesc] = useState("");

  useEffect(() => {
    loadLogs(1);
    loadTemplates();
  }, []);

  function loadLogs(page: number) {
    getWhatsAppLogsAction(page, 10).then((data) => {
      setLogs(data.logs);
      setLogPages(data.pages);
      setLogTotal(data.total);
      setLogPage(page);
    }).catch(console.error);
  }

  function loadTemplates() {
    getWhatsAppTemplatesAction().then((data) => {
      setTemplates(data.map((t) => ({
        id: t.id,
        name: t.name,
        bodyText: t.bodyText,
        description: t.description,
      })));
    }).catch(console.error);
  }

  function startEditing(t: TemplateEntry) {
    setEditingId(t.id);
    setEditBody(t.bodyText);
    setEditDesc(t.description || "");
  }

  function cancelEditing() {
    setEditingId(null);
    setEditBody("");
    setEditDesc("");
  }

  function handleSaveTemplate(id: string) {
    startTransition(async () => {
      try {
        await updateWhatsAppTemplateAction(id, {
          bodyText: editBody,
          description: editDesc || undefined,
        });
        toast.success("Template updated");
        setEditingId(null);
        loadTemplates();
      } catch {
        toast.error("Failed to update template");
      }
    });
  }

  function handleSaveSettings() {
    const formData = new FormData();
    formData.set("whatsappEnabled", String(enabled));
    formData.set("whatsappPhoneNumberId", phoneNumberId);
    formData.set("whatsappBusinessAccountId", businessAccountId);
    formData.set("whatsappSessionReminders", String(sessionReminders));
    formData.set("whatsappBillingReminders", String(billingReminders));
    formData.set("whatsappCreditReminders", String(creditReminders));
    if (creditExpiryDays) formData.set("creditExpiryDays", creditExpiryDays);

    startTransition(async () => {
      try {
        await updateWhatsAppSettingsAction(formData);
        toast.success("WhatsApp settings saved");
      } catch {
        toast.error("Failed to save settings");
      }
    });
  }

  function handleTestMessage() {
    if (!testPhone) return;
    startTransition(async () => {
      try {
        const result = await sendTestWhatsAppAction(testPhone);
        if (result.success) {
          toast.success("Test message sent");
        } else {
          toast.error(`Failed: ${result.error}`);
        }
        loadLogs(1);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to send test message");
      }
    });
  }

  const showSaveButton = activeSection === "connection" || activeSection === "reminders";

  return (
    <div className="flex h-[calc(100vh-10rem)] gap-6">
      {/* Sidebar */}
      <div className="flex w-48 shrink-0 flex-col">
        <div className="mb-5">
          <h2 className="font-heading text-xl font-bold">WhatsApp</h2>
          <p className="text-xs text-muted-foreground">
            Cloud API reminders
          </p>
        </div>

        <nav className="flex-1 space-y-0.5">
          {SECTIONS.map((section) => {
            const Icon = section.icon;
            return (
              <button
                key={section.id}
                type="button"
                onClick={() => setActiveSection(section.id)}
                className={cn(
                  "flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm font-medium transition-colors",
                  activeSection === section.id
                    ? "bg-brand-50 text-brand-700"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                <Icon className="h-4 w-4" />
                {section.label}
              </button>
            );
          })}
        </nav>

        {showSaveButton && (
          <div className="border-t pt-4">
            <Button
              type="button"
              onClick={handleSaveSettings}
              disabled={isPending}
              className="w-full"
            >
              {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Settings
            </Button>
          </div>
        )}
      </div>

      {/* Content area */}
      <div className="min-w-0 flex-1 overflow-y-auto pr-1">
        {/* ── Connection ── */}
        {activeSection === "connection" && (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Connection</CardTitle>
                <CardDescription>WhatsApp Business API credentials</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between rounded-lg border p-3">
                  <div>
                    <p className="text-sm font-medium">WhatsApp Enabled</p>
                    <p className="text-xs text-muted-foreground">
                      {enabled ? "Reminders will be sent via WhatsApp" : "WhatsApp reminders are disabled"}
                    </p>
                  </div>
                  <Switch checked={enabled} onCheckedChange={setEnabled} />
                </div>

                <div className="space-y-2">
                  <Label className="text-xs">Phone Number ID</Label>
                  <Input
                    value={phoneNumberId}
                    onChange={(e) => setPhoneNumberId(e.target.value)}
                    placeholder="From Meta Business Suite → WhatsApp Manager"
                    className="text-sm"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-xs">Business Account ID</Label>
                  <Input
                    value={businessAccountId}
                    onChange={(e) => setBusinessAccountId(e.target.value)}
                    placeholder="WABA ID from Meta Business Suite"
                    className="text-sm"
                  />
                </div>

                <div className="flex items-center gap-2 rounded-lg border p-3">
                  {whatsappTokenSet ? (
                    <>
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                      <span className="text-sm text-green-700">Access token configured</span>
                    </>
                  ) : (
                    <>
                      <XCircle className="h-4 w-4 text-red-500" />
                      <span className="text-sm text-red-600">
                        Access token not set — add <code className="rounded bg-muted px-1 text-xs">WHATSAPP_ACCESS_TOKEN</code> to environment variables
                      </span>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Test Message</CardTitle>
                <CardDescription>Verify your connection works</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex gap-2">
                  <Input
                    value={testPhone}
                    onChange={(e) => setTestPhone(e.target.value)}
                    placeholder="e.g. 0821234567"
                    className="text-sm"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleTestMessage}
                    disabled={isPending || !testPhone}
                  >
                    <Send className="mr-1 h-3.5 w-3.5" />
                    Test
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Sends the &quot;hello_world&quot; template (available on all new WABA accounts).
                </p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* ── Reminders ── */}
        {activeSection === "reminders" && (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Reminder Configuration</CardTitle>
                <CardDescription>Choose which automated reminders to send</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between rounded-lg border p-3">
                  <div>
                    <p className="text-sm font-medium">Session Reminders</p>
                    <p className="text-xs text-muted-foreground">
                      48 hours before + morning of session (08:00 SAST)
                    </p>
                  </div>
                  <Switch checked={sessionReminders} onCheckedChange={setSessionReminders} />
                </div>

                <div className="flex items-center justify-between rounded-lg border p-3">
                  <div>
                    <p className="text-sm font-medium">Billing Reminders</p>
                    <p className="text-xs text-muted-foreground">
                      Payment request sent, 2 days before due, and overdue notice
                    </p>
                  </div>
                  <Switch checked={billingReminders} onCheckedChange={setBillingReminders} />
                </div>

                <div className="flex items-center justify-between rounded-lg border p-3">
                  <div>
                    <p className="text-sm font-medium">Credit Expiry Warnings</p>
                    <p className="text-xs text-muted-foreground">
                      14 days and 3 days before session credits expire
                    </p>
                  </div>
                  <Switch checked={creditReminders} onCheckedChange={setCreditReminders} />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Credit Expiry</CardTitle>
                <CardDescription>Configure when session credits expire</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="space-y-2">
                  <Label className="text-xs">Expiry Period (days)</Label>
                  <Input
                    type="number"
                    min={0}
                    value={creditExpiryDays}
                    onChange={(e) => setCreditExpiryDays(e.target.value)}
                    placeholder="Leave empty for no expiry"
                    className="w-32 text-sm"
                  />
                  <p className="text-xs text-muted-foreground">
                    Credits expire this many days after purchase. Leave empty for no expiry.
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* ── Templates ── */}
        {activeSection === "templates" && (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Message Templates</CardTitle>
                <CardDescription>
                  Body texts submitted to Meta for approval. Edit here to keep in sync with WhatsApp Manager. All templates use the <strong>Utility</strong> category.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {templates.length === 0 ? (
                  <p className="py-6 text-center text-sm text-muted-foreground">
                    Loading templates...
                  </p>
                ) : (
                  templates.map((t) => (
                    <div key={t.id} className="rounded-lg border p-3">
                      {editingId === t.id ? (
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <code className="rounded bg-muted px-1.5 py-0.5 text-xs font-semibold">
                              {t.name}
                            </code>
                            <div className="flex gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                onClick={() => handleSaveTemplate(t.id)}
                                disabled={isPending}
                              >
                                <Save className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                onClick={cancelEditing}
                                disabled={isPending}
                              >
                                <X className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </div>
                          <Textarea
                            value={editBody}
                            onChange={(e) => setEditBody(e.target.value)}
                            rows={2}
                            className="text-sm"
                            placeholder="Message body text with {{1}} placeholders"
                          />
                          <Input
                            value={editDesc}
                            onChange={(e) => setEditDesc(e.target.value)}
                            className="text-sm"
                            placeholder="Description (e.g. when this template is sent)"
                          />
                        </div>
                      ) : (
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 flex-1 space-y-1">
                            <code className="rounded bg-muted px-1.5 py-0.5 text-xs font-semibold">
                              {t.name}
                            </code>
                            <p className="text-sm text-foreground">{t.bodyText}</p>
                            {t.description && (
                              <p className="text-xs text-muted-foreground">{t.description}</p>
                            )}
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 shrink-0"
                            onClick={() => startEditing(t)}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {/* ── Message Log ── */}
        {activeSection === "log" && (
          <Card>
            <CardHeader>
              <CardTitle>Message Log</CardTitle>
              <CardDescription>
                {logTotal > 0 ? `${logTotal} messages sent` : "No messages sent yet"}
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {logs.length > 0 ? (
                <>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b text-left text-xs text-muted-foreground">
                          <th className="px-4 py-2.5">Date</th>
                          <th className="px-4 py-2.5">Client</th>
                          <th className="px-4 py-2.5">Template</th>
                          <th className="px-4 py-2.5">Status</th>
                          <th className="px-4 py-2.5">Error</th>
                        </tr>
                      </thead>
                      <tbody>
                        {logs.map((log) => (
                          <tr key={log.id} className="border-b last:border-0">
                            <td className="whitespace-nowrap px-4 py-2.5 text-muted-foreground">
                              {format(new Date(log.sentAt), "d MMM yyyy HH:mm")}
                            </td>
                            <td className="px-4 py-2.5">
                              {log.studentName || log.to}
                            </td>
                            <td className="px-4 py-2.5">
                              <code className="rounded bg-muted px-1.5 py-0.5 text-xs">
                                {log.templateName}
                              </code>
                            </td>
                            <td className="px-4 py-2.5">
                              <Badge
                                className={
                                  log.status === "failed"
                                    ? "bg-red-100 text-red-700"
                                    : "bg-green-100 text-green-700"
                                }
                              >
                                {log.status}
                              </Badge>
                            </td>
                            <td className="max-w-48 truncate px-4 py-2.5 text-xs text-muted-foreground">
                              {log.error || "—"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {logPages > 1 && (
                    <div className="flex items-center justify-between border-t px-4 py-2">
                      <span className="text-xs text-muted-foreground">
                        Page {logPage} of {logPages}
                      </span>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => loadLogs(logPage - 1)}
                          disabled={logPage <= 1}
                        >
                          <ChevronLeft className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => loadLogs(logPage + 1)}
                          disabled={logPage >= logPages}
                        >
                          <ChevronRight className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <p className="px-4 py-6 text-center text-sm text-muted-foreground">
                  No messages sent yet. Send a test message from the Connection section to verify.
                </p>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
