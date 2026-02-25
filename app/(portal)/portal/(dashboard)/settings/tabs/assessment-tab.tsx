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
import { updateAssessmentAction } from "../actions";
import { Loader2, Check } from "lucide-react";

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

interface AssessmentTabProps {
  readonly intake: IntakeData | null;
}

export function AssessmentTab({ intake }: AssessmentTabProps) {
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
