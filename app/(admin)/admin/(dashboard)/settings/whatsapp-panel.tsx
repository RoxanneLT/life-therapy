"use client";

import { useState, useEffect, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
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
} from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import {
  updateWhatsAppSettingsAction,
  sendTestWhatsAppAction,
  getWhatsAppLogsAction,
} from "./whatsapp-actions";
import type { SiteSetting } from "@/lib/generated/prisma/client";

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

interface WhatsAppPanelProps {
  initialSettings: SiteSetting;
  whatsappTokenSet: boolean;
}

// ─── Template Reference Data ─────────────────────────────────

const TEMPLATE_REFERENCE = [
  {
    name: "session_reminder_48h",
    body: "Hi {{1}}, this is a reminder that your {{2}} session is on {{3}} at {{4}}.",
  },
  {
    name: "session_reminder_today",
    body: "Hi {{1}}, your session is today at {{2}}. Join here: {{3}}",
  },
  {
    name: "billing_request",
    body: "Hi {{1}}, your {{2}} invoice of {{3}} is due by {{4}}. Pay here: {{5}}",
  },
  {
    name: "billing_reminder",
    body: "Hi {{1}}, a friendly reminder that {{2}} is due by {{3}}. Pay here: {{4}}",
  },
  {
    name: "billing_overdue",
    body: "Hi {{1}}, your payment of {{2}} for {{3}} is overdue. Please pay here: {{4}}",
  },
  {
    name: "credit_expiry_14d",
    body: "Hi {{1}}, you have {{2}} session credit(s) expiring on {{3}}. Book now to use them!",
  },
  {
    name: "credit_expiry_3d",
    body: "Hi {{1}}, your {{2}} session credit(s) expire on {{3}} — only 3 days left!",
  },
];

// ─── Main Component ──────────────────────────────────────────

export function WhatsAppPanel({
  initialSettings,
  whatsappTokenSet,
}: WhatsAppPanelProps) {
  const s = initialSettings;
  const [isPending, startTransition] = useTransition();

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

  useEffect(() => {
    loadLogs(1);
  }, []);

  function loadLogs(page: number) {
    getWhatsAppLogsAction(page, 10).then((data) => {
      setLogs(data.logs);
      setLogPages(data.pages);
      setLogTotal(data.total);
      setLogPage(page);
    }).catch(console.error);
  }

  function handleSave() {
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

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-heading text-xl font-bold">WhatsApp Integration</h2>
        <p className="text-sm text-muted-foreground">
          Automated session, billing, and credit reminders via WhatsApp Cloud API.
        </p>
      </div>

      {/* Section 1: Connection */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm">
            <MessageSquare className="h-4 w-4" />
            Connection
          </CardTitle>
          <CardDescription>
            Configure your WhatsApp Business API credentials.
          </CardDescription>
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

          {/* Test message */}
          <div className="space-y-2">
            <Label className="text-xs">Send Test Message</Label>
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
          </div>
        </CardContent>
      </Card>

      {/* Section 2: Reminder Configuration */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm">
            <Bell className="h-4 w-4" />
            Reminder Configuration
          </CardTitle>
          <CardDescription>
            Choose which automated reminders to send.
          </CardDescription>
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

          <div className="space-y-2">
            <Label className="text-xs">Credit Expiry Period (days)</Label>
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

      {/* Save Button */}
      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={isPending}>
          {isPending ? "Saving..." : "Save Settings"}
        </Button>
      </div>

      {/* Section 3: Message Log */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm">
            <MessageSquare className="h-4 w-4" />
            Message Log
          </CardTitle>
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
              No messages sent yet. Send a test message above to verify the connection.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Section 4: Template Reference */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm">
            <Send className="h-4 w-4" />
            Template Reference
          </CardTitle>
          <CardDescription>
            Submit these templates in Meta Business Suite under WhatsApp Manager &rarr; Message Templates. All templates use the <strong>Utility</strong> category.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs text-muted-foreground">
                  <th className="px-4 py-2.5">Template Name</th>
                  <th className="px-4 py-2.5">Body Text</th>
                </tr>
              </thead>
              <tbody>
                {TEMPLATE_REFERENCE.map((t) => (
                  <tr key={t.name} className="border-b last:border-0">
                    <td className="whitespace-nowrap px-4 py-2.5">
                      <code className="rounded bg-muted px-1.5 py-0.5 text-xs">
                        {t.name}
                      </code>
                    </td>
                    <td className="px-4 py-2.5 text-muted-foreground">
                      {t.body}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
