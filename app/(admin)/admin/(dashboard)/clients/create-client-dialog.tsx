"use client";

import { useState, useTransition } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { UserPlus, Loader2, ChevronLeft, ChevronRight } from "lucide-react";
import { createClientAction } from "./actions";
import { useRouter } from "next/navigation";

type Step = 1 | 2 | 3;

const STEP_LABELS: Record<Step, string> = {
  1: "Basic Details",
  2: "Personal Information",
  3: "Preferences & Notes",
};

export function CreateClientDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [step, setStep] = useState<Step>(1);
  const [error, setError] = useState("");

  // Step 1: Basic details (required)
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [isMinor, setIsMinor] = useState(false);
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [clientStatus, setClientStatus] = useState("potential");
  const [billingType, setBillingType] = useState("postpaid");

  // Step 2: Personal info (optional)
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [gender, setGender] = useState("");
  const [relationshipStatus, setRelationshipStatus] = useState("");
  const [address, setAddress] = useState("");
  const [emergencyContact, setEmergencyContact] = useState("");
  const [referralSource, setReferralSource] = useState("");
  const [referralDetail, setReferralDetail] = useState("");

  // Step 3: Preferences & notes (optional)
  const [newsletterOptIn, setNewsletterOptIn] = useState(true);
  const [marketingOptIn, setMarketingOptIn] = useState(true);
  const [smsOptIn, setSmsOptIn] = useState(false);
  const [sessionReminders, setSessionReminders] = useState(true);
  const [adminNotes, setAdminNotes] = useState("");

  function resetForm() {
    setStep(1);
    setError("");
    setFirstName("");
    setLastName("");
    setIsMinor(false);
    setEmail("");
    setPhone("");
    setClientStatus("potential");
    setBillingType("prepaid");
    setDateOfBirth("");
    setGender("");
    setRelationshipStatus("");
    setAddress("");
    setEmergencyContact("");
    setReferralSource("");
    setReferralDetail("");
    setNewsletterOptIn(true);
    setMarketingOptIn(true);
    setSmsOptIn(false);
    setSessionReminders(true);
    setAdminNotes("");
  }

  function handleOpenChange(isOpen: boolean) {
    setOpen(isOpen);
    if (!isOpen) resetForm();
  }

  function validateStep1(): boolean {
    if (!firstName.trim()) { setError("First name is required"); return false; }
    if (!lastName.trim()) { setError("Last name is required"); return false; }
    if (!isMinor) {
      if (!email.trim()) { setError("Email is required"); return false; }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) { setError("Invalid email address"); return false; }
    }
    setError("");
    return true;
  }

  function handleNext() {
    if (step === 1 && !validateStep1()) return;
    setError("");
    setStep((s) => Math.min(s + 1, 3) as Step);
  }

  function handleBack() {
    setError("");
    setStep((s) => Math.max(s - 1, 1) as Step);
  }

  function handleSubmit() {
    setError("");
    startTransition(async () => {
      try {
        const result = await createClientAction({
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          email: email.trim().toLowerCase() || undefined,
          isMinor,
          phone: phone.trim() || undefined,
          clientStatus,
          billingType,
          dateOfBirth: dateOfBirth || undefined,
          gender: gender.trim() || undefined,
          relationshipStatus: relationshipStatus.trim() || undefined,
          address: address.trim() || undefined,
          emergencyContact: emergencyContact.trim() || undefined,
          referralSource: referralSource.trim() || undefined,
          referralDetail: referralDetail.trim() || undefined,
          newsletterOptIn,
          marketingOptIn,
          smsOptIn,
          sessionReminders,
          adminNotes: adminNotes.trim() || undefined,
        });
        setOpen(false);
        resetForm();
        router.push(`/admin/clients/${result.clientId}`);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to create client");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button size="sm" className="gap-1.5">
          <UserPlus className="h-4 w-4" />
          Add Client
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            Add Client — {STEP_LABELS[step]}
          </DialogTitle>
          <div className="flex gap-1 pt-1">
            {([1, 2, 3] as Step[]).map((s) => (
              <div
                key={s}
                className={`h-1 flex-1 rounded-full transition-colors ${
                  s <= step ? "bg-brand-500" : "bg-muted"
                }`}
              />
            ))}
          </div>
        </DialogHeader>

        {/* Step 1: Basic Details */}
        {step === 1 && (
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="firstName">First Name *</Label>
                <Input
                  id="firstName"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder="e.g. Angela"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="lastName">Last Name *</Label>
                <Input
                  id="lastName"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder="e.g. Gohre"
                />
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={isMinor}
                onChange={(e) => {
                  setIsMinor(e.target.checked);
                  if (e.target.checked) setEmail("");
                }}
                className="h-4 w-4 rounded border-gray-300"
              />
              Minor / child (no email or portal access)
            </label>
            {!isMinor && (
              <div className="space-y-1.5">
                <Label htmlFor="email">Email *</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="e.g. angela@example.com"
                />
              </div>
            )}
            {isMinor && (
              <div className="rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-800 dark:border-blue-800 dark:bg-blue-950/30 dark:text-blue-300">
                Minor accounts don&apos;t require an email and cannot log in. A parent/guardian manages bookings on their behalf.
              </div>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="phone">Phone</Label>
              <Input
                id="phone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+27..."
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Client Status</Label>
                <Select value={clientStatus} onValueChange={setClientStatus}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="potential">Potential</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Billing Type</Label>
                <Select value={billingType} onValueChange={setBillingType}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="prepaid">Pre-paid (credits)</SelectItem>
                    <SelectItem value="postpaid">Post-paid (invoiced)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        )}

        {/* Step 2: Personal Information */}
        {step === 2 && (
          <div className="space-y-4">
            <p className="text-xs text-muted-foreground">
              All fields on this step are optional.
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="dob">Date of Birth</Label>
                <Input
                  id="dob"
                  type="date"
                  value={dateOfBirth}
                  onChange={(e) => setDateOfBirth(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="gender">Gender</Label>
                <Input
                  id="gender"
                  value={gender}
                  onChange={(e) => setGender(e.target.value)}
                  placeholder="e.g. Female"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="relationship">Relationship Status</Label>
                <Input
                  id="relationship"
                  value={relationshipStatus}
                  onChange={(e) => setRelationshipStatus(e.target.value)}
                  placeholder="e.g. Married"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="emergency">Emergency Contact</Label>
                <Input
                  id="emergency"
                  value={emergencyContact}
                  onChange={(e) => setEmergencyContact(e.target.value)}
                  placeholder="Name — phone number"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="referralSource">Referral Source</Label>
                <Input
                  id="referralSource"
                  value={referralSource}
                  onChange={(e) => setReferralSource(e.target.value)}
                  placeholder="e.g. Google, friend, etc."
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="referralDetail">Referral Detail</Label>
                <Input
                  id="referralDetail"
                  value={referralDetail}
                  onChange={(e) => setReferralDetail(e.target.value)}
                  placeholder="Additional referral info"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="address">Address</Label>
              <textarea
                id="address"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                rows={2}
                className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                placeholder="Full address..."
              />
            </div>
          </div>
        )}

        {/* Step 3: Preferences & Notes */}
        {step === 3 && (
          <div className="space-y-4">
            <div>
              <p className="mb-2 text-sm font-medium">Communication Preferences</p>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={newsletterOptIn}
                    onChange={(e) => setNewsletterOptIn(e.target.checked)}
                    className="h-4 w-4 rounded border-gray-300"
                  />
                  Newsletter
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={marketingOptIn}
                    onChange={(e) => setMarketingOptIn(e.target.checked)}
                    className="h-4 w-4 rounded border-gray-300"
                  />
                  Marketing emails
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={smsOptIn}
                    onChange={(e) => setSmsOptIn(e.target.checked)}
                    className="h-4 w-4 rounded border-gray-300"
                  />
                  WhatsApp notifications
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={sessionReminders}
                    onChange={(e) => setSessionReminders(e.target.checked)}
                    className="h-4 w-4 rounded border-gray-300"
                  />
                  Session reminders
                </label>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="adminNotes">Admin Notes</Label>
              <textarea
                id="adminNotes"
                value={adminNotes}
                onChange={(e) => setAdminNotes(e.target.value)}
                rows={3}
                className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                placeholder="Internal notes about this client..."
              />
            </div>
          </div>
        )}

        {error && <p className="text-sm text-destructive">{error}</p>}

        {/* Navigation buttons */}
        <div className="flex justify-between pt-2">
          <div>
            {step > 1 && (
              <Button variant="ghost" size="sm" onClick={handleBack} disabled={isPending}>
                <ChevronLeft className="mr-1 h-4 w-4" />
                Back
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            {step < 3 ? (
              <>
                {step === 1 && (
                  <Button variant="ghost" size="sm" onClick={() => { if (validateStep1()) handleSubmit(); }} disabled={isPending}>
                    Skip & Create
                  </Button>
                )}
                {step === 2 && (
                  <Button variant="ghost" size="sm" onClick={handleSubmit} disabled={isPending}>
                    Skip & Create
                  </Button>
                )}
                <Button size="sm" onClick={handleNext}>
                  Next
                  <ChevronRight className="ml-1 h-4 w-4" />
                </Button>
              </>
            ) : (
              <Button size="sm" onClick={handleSubmit} disabled={isPending}>
                {isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating...
                  </>
                ) : (
                  "Create Client"
                )}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
