"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ToggleChipGrid } from "@/components/ui/toggle-chip-grid";
import {
  BEHAVIOUR_OPTIONS,
  FEELING_OPTIONS,
  SYMPTOM_OPTIONS,
} from "@/lib/intake-options";
import { updateProfileAction, updateAssessmentAction } from "./actions";
import { Loader2, Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface StudentData {
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  dateOfBirth: string | null;
  gender: string | null;
  address: string | null;
  relationshipStatus: string | null;
  emergencyContact: string | null;
  referralSource: string | null;
  referralDetail: string | null;
}

interface IntakeData {
  behaviours: string[];
  feelings: string[];
  symptoms: string[];
  otherBehaviours: string | null;
  otherFeelings: string | null;
  otherSymptoms: string | null;
  additionalNotes: string | null;
  lastEditedBy: string | null;
}

interface ProfileClientProps {
  student: StudentData;
  intake: IntakeData | null;
  activeTab: "personal" | "assessment";
}

export function ProfileClient({ student, intake, activeTab }: ProfileClientProps) {
  const router = useRouter();
  const [tab, setTab] = useState(activeTab);

  function switchTab(t: "personal" | "assessment") {
    setTab(t);
    router.replace(`/portal/profile${t === "assessment" ? "?tab=assessment" : ""}`, {
      scroll: false,
    });
  }

  return (
    <div className="space-y-6">
      {/* Tab switcher */}
      <div className="flex gap-1 rounded-lg bg-muted p-1">
        <button
          onClick={() => switchTab("personal")}
          className={cn(
            "flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
            tab === "personal"
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          Personal Details
        </button>
        <button
          onClick={() => switchTab("assessment")}
          className={cn(
            "flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
            tab === "assessment"
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          Assessment
        </button>
      </div>

      {tab === "personal" && <PersonalTab student={student} />}
      {tab === "assessment" && <AssessmentTab intake={intake} />}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Personal Details Tab                                               */
/* ------------------------------------------------------------------ */

function PersonalTab({ student }: { student: StudentData }) {
  const [isPending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      setError(null);
      setSaved(false);
      const result = await updateProfileAction(formData);
      if (result?.error) {
        setError(result.error);
      } else {
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
      }
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Personal Details</CardTitle>
      </CardHeader>
      <CardContent>
        <form action={handleSubmit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="firstName">First Name *</Label>
              <Input id="firstName" name="firstName" defaultValue={student.firstName} required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="lastName">Last Name *</Label>
              <Input id="lastName" name="lastName" defaultValue={student.lastName} required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input id="email" value={student.email} disabled className="bg-muted" />
              <p className="text-xs text-muted-foreground">
                Contact support to change your email address.
              </p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="phone">Phone</Label>
              <Input id="phone" name="phone" defaultValue={student.phone || ""} placeholder="+27..." />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="dateOfBirth">Date of Birth</Label>
              <Input id="dateOfBirth" name="dateOfBirth" type="date" defaultValue={student.dateOfBirth || ""} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="gender">Gender</Label>
              <Input id="gender" name="gender" defaultValue={student.gender || ""} placeholder="e.g. Female" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="relationshipStatus">Relationship Status</Label>
              <Input id="relationshipStatus" name="relationshipStatus" defaultValue={student.relationshipStatus || ""} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="emergencyContact">Emergency Contact</Label>
              <Input id="emergencyContact" name="emergencyContact" defaultValue={student.emergencyContact || ""} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="referralSource">How did you hear about us?</Label>
              <Input id="referralSource" name="referralSource" defaultValue={student.referralSource || ""} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="referralDetail">Referral Details</Label>
            <Input
              id="referralDetail"
              name="referralDetail"
              defaultValue={student.referralDetail || ""}
              placeholder="e.g. referred by a friend, Google search, etc."
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="address">Address</Label>
            <Textarea id="address" name="address" defaultValue={student.address || ""} rows={2} />
          </div>

          {error && (
            <div className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
          )}

          <div className="flex items-center justify-end gap-3">
            {saved && (
              <span className="flex items-center gap-1 text-sm text-green-600">
                <Check className="h-4 w-4" /> Saved
              </span>
            )}
            <Button type="submit" disabled={isPending}>
              {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Changes
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/*  Assessment Tab                                                      */
/* ------------------------------------------------------------------ */

function AssessmentTab({ intake }: { intake: IntakeData | null }) {
  const [isPending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [behaviours, setBehaviours] = useState<string[]>(intake?.behaviours || []);
  const [feelings, setFeelings] = useState<string[]>(intake?.feelings || []);
  const [symptoms, setSymptoms] = useState<string[]>(intake?.symptoms || []);
  const [otherBehaviours, setOtherBehaviours] = useState(intake?.otherBehaviours || "");
  const [otherFeelings, setOtherFeelings] = useState(intake?.otherFeelings || "");
  const [otherSymptoms, setOtherSymptoms] = useState(intake?.otherSymptoms || "");
  const [additionalNotes, setAdditionalNotes] = useState(intake?.additionalNotes || "");

  function handleSubmit() {
    startTransition(async () => {
      setError(null);
      setSaved(false);
      const result = await updateAssessmentAction({
        behaviours,
        feelings,
        symptoms,
        otherBehaviours: otherBehaviours.trim() || undefined,
        otherFeelings: otherFeelings.trim() || undefined,
        otherSymptoms: otherSymptoms.trim() || undefined,
        additionalNotes: additionalNotes.trim() || undefined,
      });
      if (result && "error" in result) {
        setError(result.error as string);
      } else {
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
      }
    });
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">Experienced Behaviours</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <ToggleChipGrid options={BEHAVIOUR_OPTIONS} selected={behaviours} onChange={setBehaviours} />
          <div>
            <Label className="text-xs text-muted-foreground">Other</Label>
            <Input
              value={otherBehaviours}
              onChange={(e) => setOtherBehaviours(e.target.value)}
              placeholder="Other behaviours..."
              className="mt-1"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">Experienced Feelings</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <ToggleChipGrid options={FEELING_OPTIONS} selected={feelings} onChange={setFeelings} />
          <div>
            <Label className="text-xs text-muted-foreground">Other</Label>
            <Input
              value={otherFeelings}
              onChange={(e) => setOtherFeelings(e.target.value)}
              placeholder="Other feelings..."
              className="mt-1"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">Physical Symptoms</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <ToggleChipGrid options={SYMPTOM_OPTIONS} selected={symptoms} onChange={setSymptoms} />
          <div>
            <Label className="text-xs text-muted-foreground">Other</Label>
            <Input
              value={otherSymptoms}
              onChange={(e) => setOtherSymptoms(e.target.value)}
              placeholder="Other symptoms..."
              className="mt-1"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">Additional Notes for Roxanne</CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea
            value={additionalNotes}
            onChange={(e) => setAdditionalNotes(e.target.value)}
            placeholder="Anything else you'd like to share..."
            rows={4}
          />
        </CardContent>
      </Card>

      {error && (
        <div className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      <div className="flex items-center justify-end gap-3">
        {saved && (
          <span className="flex items-center gap-1 text-sm text-green-600">
            <Check className="h-4 w-4" /> Saved
          </span>
        )}
        <Button type="button" onClick={handleSubmit} disabled={isPending}>
          {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Save Changes
        </Button>
      </div>
    </div>
  );
}
