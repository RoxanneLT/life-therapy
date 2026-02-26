"use client";

import { useState, useTransition } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Pencil, Save, X } from "lucide-react";
import { updateClientProfileAction } from "../../actions";
import { format } from "date-fns";

interface PersonalTabProps {
  readonly client: Record<string, unknown>;
}

function DisplayField({ label, value }: Readonly<{ label: string; value: string | null | undefined }>) {
  return (
    <div>
      <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 text-sm">{value || "—"}</dd>
    </div>
  );
}

function FormField({
  label,
  name,
  defaultValue,
  type = "text",
  placeholder,
}: Readonly<{
  label: string;
  name: string;
  defaultValue?: string | null;
  type?: string;
  placeholder?: string;
}>) {
  return (
    <div>
      <label htmlFor={name} className="text-xs font-medium text-muted-foreground">
        {label}
      </label>
      <input
        id={name}
        name={name}
        type={type}
        defaultValue={defaultValue || ""}
        placeholder={placeholder}
        className="mt-0.5 block w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
      />
    </div>
  );
}

function CheckboxField({
  label,
  name,
  defaultChecked,
}: Readonly<{
  label: string;
  name: string;
  defaultChecked?: boolean;
}>) {
  return (
    <label className="flex items-center gap-2 text-sm">
      <input
        type="checkbox"
        name={name}
        defaultChecked={defaultChecked}
        className="h-4 w-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500"
      />
      {label}
    </label>
  );
}

export function PersonalTab({ client }: PersonalTabProps) {
  const [editing, setEditing] = useState(false);
  const [isPending, startTransition] = useTransition();

  const dateOfBirth = client.dateOfBirth
    ? format(new Date(client.dateOfBirth as string), "yyyy-MM-dd")
    : null;
  const dateOfBirthDisplay = client.dateOfBirth
    ? format(new Date(client.dateOfBirth as string), "d MMMM yyyy")
    : null;

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      await updateClientProfileAction(client.id as string, formData);
      setEditing(false);
    });
  }

  if (editing) {
    return (
      <form action={handleSubmit}>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Personal Information</CardTitle>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setEditing(false)}
                disabled={isPending}
              >
                <X className="mr-1.5 h-3.5 w-3.5" />
                Cancel
              </Button>
              <Button type="submit" size="sm" disabled={isPending}>
                <Save className="mr-1.5 h-3.5 w-3.5" />
                {isPending ? "Saving..." : "Save"}
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField label="First Name" name="firstName" defaultValue={client.firstName as string} />
              <FormField label="Last Name" name="lastName" defaultValue={client.lastName as string} />
              <FormField label="Email" name="email" defaultValue={client.email as string} type="email" />
              <FormField label="Phone" name="phone" defaultValue={client.phone as string} placeholder="+27..." />
              <FormField label="Date of Birth" name="dateOfBirth" defaultValue={dateOfBirth} type="date" />
              <FormField label="Gender" name="gender" defaultValue={client.gender as string} placeholder="e.g. Female" />
              <FormField label="Relationship Status" name="relationshipStatus" defaultValue={client.relationshipStatus as string} />
              <FormField label="Emergency Contact" name="emergencyContact" defaultValue={client.emergencyContact as string} />
              <FormField label="Referral Source" name="referralSource" defaultValue={client.referralSource as string} />
              <FormField label="Referral Detail" name="referralDetail" defaultValue={client.referralDetail as string} />
            </div>

            <div>
              <label htmlFor="address" className="text-xs font-medium text-muted-foreground">
                Address
              </label>
              <textarea
                id="address"
                name="address"
                defaultValue={(client.address as string) || ""}
                rows={2}
                className="mt-0.5 block w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>

            <div>
              <p className="mb-2 text-xs font-medium text-muted-foreground">Communication Preferences</p>
              <div className="grid gap-3 sm:grid-cols-2">
                <CheckboxField label="Newsletter" name="newsletterOptIn" defaultChecked={client.newsletterOptIn as boolean} />
                <CheckboxField label="Marketing emails" name="marketingOptIn" defaultChecked={client.marketingOptIn as boolean} />
                <CheckboxField label="WhatsApp notifications" name="smsOptIn" defaultChecked={client.smsOptIn as boolean} />
                <CheckboxField label="Session reminders" name="sessionReminders" defaultChecked={client.sessionReminders as boolean} />
              </div>
            </div>
          </CardContent>
        </Card>
      </form>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">Personal Information</CardTitle>
        <Button variant="ghost" size="sm" onClick={() => setEditing(true)}>
          <Pencil className="mr-1.5 h-3.5 w-3.5" />
          Edit
        </Button>
      </CardHeader>
      <CardContent className="space-y-6">
        <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <DisplayField label="First Name" value={client.firstName as string} />
          <DisplayField label="Last Name" value={client.lastName as string} />
          <DisplayField label="Email" value={client.email as string} />
          <DisplayField label="Phone" value={client.phone as string} />
          <DisplayField label="Date of Birth" value={dateOfBirthDisplay} />
          <DisplayField label="Gender" value={client.gender as string} />
          <DisplayField label="Relationship Status" value={client.relationshipStatus as string} />
          <DisplayField label="Emergency Contact" value={client.emergencyContact as string} />
          <DisplayField label="Referral Source" value={client.referralSource as string} />
          <DisplayField label="Referral Detail" value={client.referralDetail as string} />
          <DisplayField label="Address" value={client.address as string} />
          <DisplayField label="Source" value={client.source as string} />
        </dl>

        <div>
          <p className="mb-2 text-xs font-medium text-muted-foreground">Communication Preferences</p>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            <CommPref label="Newsletter" active={client.newsletterOptIn as boolean} />
            <CommPref label="Marketing" active={client.marketingOptIn as boolean} />
            <CommPref label="WhatsApp" active={client.smsOptIn as boolean} />
            <CommPref label="Session Reminders" active={client.sessionReminders as boolean} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function CommPref({ label, active }: Readonly<{ label: string; active: boolean }>) {
  return (
    <div className="flex items-center gap-2 text-sm">
      <div className={`h-2 w-2 rounded-full ${active ? "bg-green-500" : "bg-gray-300"}`} />
      <span className={active ? "text-foreground" : "text-muted-foreground"}>{label}</span>
    </div>
  );
}
