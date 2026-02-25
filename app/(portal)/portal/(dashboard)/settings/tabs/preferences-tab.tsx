"use client";

import { useTransition, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { updatePreferenceAction } from "../actions";
import { Loader2 } from "lucide-react";

interface PreferencesTabProps {
  readonly newsletterOptIn: boolean;
  readonly marketingOptIn: boolean;
  readonly smsOptIn: boolean;
  readonly sessionReminders: boolean;
}

const PREFS = [
  {
    field: "newsletterOptIn",
    label: "Newsletter",
    description: "Receive our monthly newsletter with tips and insights",
  },
  {
    field: "marketingOptIn",
    label: "Marketing Emails",
    description: "Receive promotional emails about new courses and offers",
  },
  {
    field: "smsOptIn",
    label: "WhatsApp Reminders",
    description: "Receive session and billing reminders via WhatsApp",
  },
  {
    field: "sessionReminders",
    label: "Session Reminders",
    description: "Get reminders before your upcoming sessions",
  },
] as const;

export function PreferencesTab(props: PreferencesTabProps) {
  const [values, setValues] = useState<Record<string, boolean>>({
    newsletterOptIn: props.newsletterOptIn,
    marketingOptIn: props.marketingOptIn,
    smsOptIn: props.smsOptIn,
    sessionReminders: props.sessionReminders,
  });
  const [saving, setSaving] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function toggle(field: string, checked: boolean) {
    setValues((prev) => ({ ...prev, [field]: checked }));
    setSaving(field);
    startTransition(async () => {
      await updatePreferenceAction(field, checked);
      setSaving(null);
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Communication Preferences</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {PREFS.map((pref) => (
          <div key={pref.field} className="flex items-center justify-between gap-4">
            <div className="space-y-0.5">
              <Label className="text-sm font-medium">{pref.label}</Label>
              <p className="text-xs text-muted-foreground">{pref.description}</p>
            </div>
            <div className="flex items-center gap-2">
              {saving === pref.field && isPending && (
                <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
              )}
              <Switch
                checked={values[pref.field]}
                onCheckedChange={(checked) => toggle(pref.field, checked)}
                disabled={saving === pref.field && isPending}
              />
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
