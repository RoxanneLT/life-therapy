"use client";

import { useState, useTransition } from "react";
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
import {
  savePersonalDetailsAction,
  saveAssessmentAction,
  acceptOnboardingDocumentsAction,
} from "@/app/(portal)/portal/(dashboard)/onboarding/actions";
import { ArrowLeft, ArrowRight, Check, Loader2, Info } from "lucide-react";
import { cn } from "@/lib/utils";

interface StudentData {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  smsOptIn: boolean;
  dateOfBirth: string | null;
  gender: string | null;
  address: string | null;
  relationshipStatus: string | null;
  emergencyContact: string | null;
  referralSource: string | null;
  referralDetail: string | null;
  onboardingStep: number;
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

interface LegalDocumentData {
  slug: string;
  title: string;
  content: { heading: string; content: string }[];
  version: number;
}

interface OnboardingWizardProps {
  student: StudentData;
  intake: IntakeData | null;
  onboardingDocuments: LegalDocumentData[];
  initialStep?: number;
}

const STEP_LABELS = ["Personal Details", "Assessment", "Agreement"];

export function OnboardingWizard({
  student,
  intake,
  onboardingDocuments,
  initialStep,
}: OnboardingWizardProps) {
  // Clamp initial step: can't skip ahead past onboardingStep + 1
  const maxAllowed = student.onboardingStep + 1;
  const startStep = initialStep
    ? Math.min(Math.max(initialStep, 1), Math.min(maxAllowed, 3))
    : Math.min(maxAllowed, 3);

  const [currentStep, setCurrentStep] = useState(startStep);
  const [completedStep, setCompletedStep] = useState(student.onboardingStep);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function goToStep(step: number) {
    if (step >= 1 && step <= completedStep + 1 && step <= 3) {
      setCurrentStep(step);
      setError(null);
    }
  }

  return (
    <div className="space-y-6">
      {/* Step indicator */}
      <div className="flex items-center gap-2">
        {STEP_LABELS.map((label, i) => {
          const stepNum = i + 1;
          const isCompleted = completedStep >= stepNum;
          const isCurrent = currentStep === stepNum;
          const isClickable = stepNum <= completedStep + 1;

          return (
            <div key={label} className="flex flex-1 items-center gap-2">
              <button
                type="button"
                disabled={!isClickable}
                onClick={() => goToStep(stepNum)}
                className={cn(
                  "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold transition-colors",
                  isCompleted && !isCurrent && "bg-green-100 text-green-700 hover:bg-green-200",
                  isCurrent && "bg-brand-600 text-white",
                  !isCompleted && !isCurrent && "bg-muted text-muted-foreground",
                  isClickable && !isCurrent && "cursor-pointer",
                  !isClickable && "cursor-not-allowed",
                )}
              >
                {isCompleted && !isCurrent ? <Check className="h-4 w-4" /> : stepNum}
              </button>
              <span className={cn(
                "hidden text-xs font-medium sm:inline",
                isCurrent ? "text-foreground" : "text-muted-foreground",
              )}>
                {label}
              </span>
              {i < STEP_LABELS.length - 1 && (
                <div className={cn(
                  "h-px flex-1",
                  completedStep >= stepNum ? "bg-green-300" : "bg-muted",
                )} />
              )}
            </div>
          );
        })}
      </div>

      {error && (
        <div className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      {/* Step 1: Personal Details */}
      {currentStep === 1 && (
        <PersonalDetailsStep
          student={student}
          isPending={isPending}
          onSubmit={(formData) => {
            startTransition(async () => {
              setError(null);
              const result = await savePersonalDetailsAction(formData);
              if (result?.error) {
                setError(result.error);
              } else {
                setCompletedStep((prev) => Math.max(prev, 1));
                setCurrentStep(2);
              }
            });
          }}
        />
      )}

      {/* Step 2: Assessment */}
      {currentStep === 2 && (
        <AssessmentStep
          intake={intake}
          isPending={isPending}
          onBack={() => goToStep(1)}
          onSubmit={(data) => {
            startTransition(async () => {
              setError(null);
              const result = await saveAssessmentAction(data) as { success?: boolean; error?: string };
              if (result?.error) {
                setError(result.error);
              } else {
                setCompletedStep((prev) => Math.max(prev, 2));
                setCurrentStep(3);
              }
            });
          }}
        />
      )}

      {/* Step 3: Agreement (Commitment + Terms) */}
      {currentStep === 3 && (
        <AgreementStep
          documents={onboardingDocuments}
          isPending={isPending}
          onBack={() => goToStep(2)}
          onSubmit={() => {
            startTransition(async () => {
              setError(null);
              await acceptOnboardingDocumentsAction();
            });
          }}
        />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Step 1: Personal Details                                           */
/* ------------------------------------------------------------------ */

function PersonalDetailsStep({
  student,
  isPending,
  onSubmit,
}: {
  student: StudentData;
  isPending: boolean;
  onSubmit: (formData: FormData) => void;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Personal Details</CardTitle>
      </CardHeader>
      <CardContent>
        <form action={onSubmit} className="space-y-4">
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
              <Label htmlFor="dateOfBirth">Date of Birth</Label>
              <Input id="dateOfBirth" name="dateOfBirth" type="date" defaultValue={student.dateOfBirth || ""} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="gender">Gender</Label>
              <Input id="gender" name="gender" defaultValue={student.gender || ""} placeholder="e.g. Female" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="phone">Phone</Label>
              <Input id="phone" name="phone" defaultValue={student.phone || ""} placeholder="+27..." />
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
          <div className="flex items-start gap-3 rounded-md border p-3">
            <input
              type="checkbox"
              id="smsOptIn"
              name="smsOptIn"
              defaultChecked={student.smsOptIn}
              className="mt-0.5 h-4 w-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500"
            />
            <div>
              <Label htmlFor="smsOptIn" className="text-sm font-medium">
                WhatsApp Reminders
              </Label>
              <p className="text-xs text-muted-foreground">
                Receive session and billing reminders via WhatsApp
              </p>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="referralDetail">Referral Details</Label>
            <Input id="referralDetail" name="referralDetail" defaultValue={student.referralDetail || ""} placeholder="e.g. referred by a friend, Google search, etc." />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="address">Address</Label>
            <Textarea id="address" name="address" defaultValue={student.address || ""} rows={2} />
          </div>
          <div className="flex justify-end">
            <Button type="submit" disabled={isPending}>
              {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Save & Continue
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/*  Step 2: Assessment                                                 */
/* ------------------------------------------------------------------ */

function AssessmentStep({
  intake,
  isPending,
  onBack,
  onSubmit,
}: {
  intake: IntakeData | null;
  isPending: boolean;
  onBack: () => void;
  onSubmit: (data: {
    behaviours: string[];
    feelings: string[];
    symptoms: string[];
    otherBehaviours?: string;
    otherFeelings?: string;
    otherSymptoms?: string;
    additionalNotes?: string;
  }) => void;
}) {
  const [behaviours, setBehaviours] = useState<string[]>(intake?.behaviours || []);
  const [feelings, setFeelings] = useState<string[]>(intake?.feelings || []);
  const [symptoms, setSymptoms] = useState<string[]>(intake?.symptoms || []);
  const [otherBehaviours, setOtherBehaviours] = useState(intake?.otherBehaviours || "");
  const [otherFeelings, setOtherFeelings] = useState(intake?.otherFeelings || "");
  const [otherSymptoms, setOtherSymptoms] = useState(intake?.otherSymptoms || "");
  const [additionalNotes, setAdditionalNotes] = useState(intake?.additionalNotes || "");

  const hasAdminPrefill = intake?.lastEditedBy === "admin" && (
    (intake.behaviours?.length || 0) > 0 ||
    (intake.feelings?.length || 0) > 0 ||
    (intake.symptoms?.length || 0) > 0
  );

  function handleSubmit() {
    onSubmit({
      behaviours,
      feelings,
      symptoms,
      otherBehaviours: otherBehaviours.trim() || undefined,
      otherFeelings: otherFeelings.trim() || undefined,
      otherSymptoms: otherSymptoms.trim() || undefined,
      additionalNotes: additionalNotes.trim() || undefined,
    });
  }

  return (
    <div className="space-y-6">
      {hasAdminPrefill && (
        <div className="flex items-start gap-2 rounded-md bg-blue-50 px-4 py-3 text-sm text-blue-700">
          <Info className="mt-0.5 h-4 w-4 shrink-0" />
          <p>Some items were pre-selected based on your consultation. Feel free to adjust them.</p>
        </div>
      )}

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">Experienced Behaviours</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <ToggleChipGrid options={BEHAVIOUR_OPTIONS} selected={behaviours} onChange={setBehaviours} />
          <div>
            <Label className="text-xs text-muted-foreground">Other</Label>
            <Input value={otherBehaviours} onChange={(e) => setOtherBehaviours(e.target.value)} placeholder="Other behaviours..." className="mt-1" />
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
            <Input value={otherFeelings} onChange={(e) => setOtherFeelings(e.target.value)} placeholder="Other feelings..." className="mt-1" />
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
            <Input value={otherSymptoms} onChange={(e) => setOtherSymptoms(e.target.value)} placeholder="Other symptoms..." className="mt-1" />
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

      <div className="flex justify-between">
        <Button type="button" variant="outline" onClick={onBack} disabled={isPending}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
        <Button type="button" onClick={handleSubmit} disabled={isPending}>
          {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          Save & Continue
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Step 3: Agreement (Commitment + Terms)                             */
/* ------------------------------------------------------------------ */

function AgreementStep({
  documents,
  isPending,
  onBack,
  onSubmit,
}: {
  documents: LegalDocumentData[];
  isPending: boolean;
  onBack: () => void;
  onSubmit: () => void;
}) {
  const [agreed, setAgreed] = useState(false);
  const [expandedDoc, setExpandedDoc] = useState<string>(
    documents[0]?.slug ?? ""
  );

  return (
    <div className="space-y-6">
      {/* Document tabs */}
      <div className="flex gap-2 border-b">
        {documents.map((doc) => (
          <button
            key={doc.slug}
            type="button"
            onClick={() => setExpandedDoc(doc.slug)}
            className={cn(
              "px-4 py-2 text-sm font-medium transition-colors -mb-px border-b-2",
              expandedDoc === doc.slug
                ? "border-brand-600 text-brand-700"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            {doc.title}
          </button>
        ))}
      </div>

      {/* Document content */}
      {documents.map((doc) => (
        <Card
          key={doc.slug}
          className={cn(expandedDoc !== doc.slug && "hidden")}
        >
          <CardHeader>
            <CardTitle className="text-base">{doc.title}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {doc.content.map((section) => (
              <div key={section.heading}>
                <h3 className="mb-1 text-sm font-semibold">
                  {section.heading}
                </h3>
                <p className="whitespace-pre-line text-sm text-muted-foreground">
                  {section.content}
                </p>
              </div>
            ))}
          </CardContent>
        </Card>
      ))}

      <label className="flex items-start gap-3 rounded-md border p-4">
        <input
          type="checkbox"
          checked={agreed}
          onChange={(e) => setAgreed(e.target.checked)}
          className="mt-0.5 h-4 w-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500"
        />
        <span className="text-sm font-medium">
          I have read and agree to the Commitment Agreement and Terms &amp; Conditions
        </span>
      </label>

      <div className="flex justify-between">
        <Button type="button" variant="outline" onClick={onBack} disabled={isPending}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
        <Button type="button" onClick={onSubmit} disabled={!agreed || isPending}>
          {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          I Agree — Let&apos;s Start
        </Button>
      </div>
    </div>
  );
}
