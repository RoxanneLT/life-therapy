"use client";

import { useState, useTransition } from "react";
import { formatPhoneDisplay } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Pencil, Save, X } from "lucide-react";
import { updateClientProfileAction } from "../../actions";
import { updateClientEmailAction } from "../actions";
import { ClientBranchSelect } from "./client-branch-select";
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
        className="mt-0.5 block w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-hidden focus:ring-2 focus:ring-brand-500"
      />
    </div>
  );
}

function UpdateEmailDialog({ clientId, currentEmail }: Readonly<{ clientId: string; currentEmail: string }>) {
  const [open, setOpen] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    startTransition(async () => {
      const result = await updateClientEmailAction(clientId, newEmail);
      if (result.success) {
        setSuccess(true);
        setTimeout(() => { setOpen(false); setSuccess(false); setNewEmail(""); }, 2000);
      } else {
        setError(result.error);
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); setError(""); setSuccess(false); setNewEmail(""); }}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-5 w-5 text-muted-foreground hover:text-foreground"
          aria-label="Update email"
        >
          <Pencil className="h-3 w-3" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Update Email Address</DialogTitle>
        </DialogHeader>
        {success ? (
          <p className="py-4 text-center text-sm text-green-600">
            ✓ Email updated. A confirmation link has been sent to the new address.
          </p>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4 pt-2">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Current email</Label>
              <p className="text-sm">{currentEmail}</p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="new-email">New email</Label>
              <Input
                id="new-email"
                type="email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                placeholder="new@example.com"
                required
                autoFocus
              />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <div className="flex justify-end gap-2 pt-1">
              <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)}>Cancel</Button>
              <Button type="submit" size="sm" disabled={isPending || !newEmail}>
                {isPending ? "Updating..." : "Update & send verification"}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
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
                className="mt-0.5 block w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-hidden focus:ring-2 focus:ring-brand-500"
              />
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
          <div>
            <dt className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              Email
              <UpdateEmailDialog clientId={client.id as string} currentEmail={client.email as string} />
            </dt>
            <dd className="mt-0.5 break-all text-sm">{(client.email as string) || "—"}</dd>
          </div>
          <DisplayField label="Phone" value={formatPhoneDisplay(client.phone as string)} />
          <DisplayField label="Date of Birth" value={dateOfBirthDisplay} />
          <DisplayField label="Gender" value={client.gender as string} />
          <DisplayField label="Relationship Status" value={client.relationshipStatus as string} />
          <DisplayField label="Emergency Contact" value={client.emergencyContact as string} />
          <DisplayField label="Referral Source" value={client.referralSource as string} />
          <DisplayField label="Referral Detail" value={client.referralDetail as string} />
          <DisplayField label="Address" value={client.address as string} />
          <DisplayField label="Source" value={client.source as string} />
        </dl>
        <div className="max-w-xs border-t pt-4">
          <ClientBranchSelect
            studentId={client.id as string}
            current={(client.branch as string | null) ?? null}
          />
        </div>
      </CardContent>
    </Card>
  );
}
