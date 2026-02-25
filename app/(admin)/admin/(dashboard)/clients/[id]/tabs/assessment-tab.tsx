"use client";

import { useState, useTransition } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ToggleChipGrid } from "@/components/ui/toggle-chip-grid";
import { Lock, Save } from "lucide-react";
import {
  BEHAVIOUR_OPTIONS,
  FEELING_OPTIONS,
  SYMPTOM_OPTIONS,
} from "@/lib/intake-options";
import { updateIntakeAction, createIntakeAction } from "../actions";
import { format } from "date-fns";

interface IntakeData {
  id: string;
  behaviours: string[];
  feelings: string[];
  symptoms: string[];
  otherBehaviours: string | null;
  otherFeelings: string | null;
  otherSymptoms: string | null;
  additionalNotes: string | null;
  adminNotes: string | null;
  lastEditedBy: string | null;
  lastEditedAt: string;
}

interface AssessmentTabProps {
  client: Record<string, unknown>;
}

export function AssessmentTab({ client }: AssessmentTabProps) {
  const intake = client.intake as IntakeData | null;
  const clientId = client.id as string;
  const [isPending, startTransition] = useTransition();

  if (!intake) {
    return <EmptyState clientId={clientId} />;
  }

  return <AssessmentForm intake={intake} clientId={clientId} isPending={isPending} startTransition={startTransition} />;
}

function EmptyState({ clientId }: { clientId: string }) {
  const [isPending, startTransition] = useTransition();

  function handleCreate() {
    startTransition(async () => {
      await createIntakeAction(clientId);
    });
  }

  return (
    <Card>
      <CardContent className="py-12 text-center">
        <p className="mb-4 text-sm text-muted-foreground">
          No assessment recorded yet.
        </p>
        <Button onClick={handleCreate} disabled={isPending}>
          {isPending ? "Creating..." : "Create Assessment"}
        </Button>
      </CardContent>
    </Card>
  );
}

function AssessmentForm({
  intake,
  clientId,
  isPending,
  startTransition,
}: {
  intake: IntakeData;
  clientId: string;
  isPending: boolean;
  startTransition: (fn: () => Promise<void>) => void;
}) {
  const [behaviours, setBehaviours] = useState<string[]>(intake.behaviours || []);
  const [feelings, setFeelings] = useState<string[]>(intake.feelings || []);
  const [symptoms, setSymptoms] = useState<string[]>(intake.symptoms || []);
  const [otherBehaviours, setOtherBehaviours] = useState(intake.otherBehaviours || "");
  const [otherFeelings, setOtherFeelings] = useState(intake.otherFeelings || "");
  const [otherSymptoms, setOtherSymptoms] = useState(intake.otherSymptoms || "");
  const [adminNotes, setAdminNotes] = useState(intake.adminNotes || "");

  function handleSave() {
    startTransition(async () => {
      await updateIntakeAction(clientId, {
        behaviours,
        feelings,
        symptoms,
        otherBehaviours: otherBehaviours.trim() || undefined,
        otherFeelings: otherFeelings.trim() || undefined,
        otherSymptoms: otherSymptoms.trim() || undefined,
        adminNotes: adminNotes.trim() || undefined,
      });
    });
  }

  const lastEdited = intake.lastEditedAt
    ? `${intake.lastEditedBy === "admin" ? "Admin" : "Client"}, ${format(new Date(intake.lastEditedAt), "d MMM yyyy")}`
    : null;

  return (
    <div className="space-y-6">
      {/* Header with last edited */}
      <div className="flex items-center justify-between">
        <h2 className="font-heading text-lg font-semibold">Assessment</h2>
        {lastEdited && (
          <p className="text-xs text-muted-foreground">Last edited: {lastEdited}</p>
        )}
      </div>

      {/* Experienced Behaviours */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">Experienced Behaviours</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <ToggleChipGrid
            options={BEHAVIOUR_OPTIONS}
            selected={behaviours}
            onChange={setBehaviours}
          />
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

      {/* Experienced Feelings */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">Experienced Feelings</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <ToggleChipGrid
            options={FEELING_OPTIONS}
            selected={feelings}
            onChange={setFeelings}
          />
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

      {/* Physical Symptoms */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">Physical Symptoms</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <ToggleChipGrid
            options={SYMPTOM_OPTIONS}
            selected={symptoms}
            onChange={setSymptoms}
          />
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

      {/* Admin Notes */}
      <Card className="border-amber-200 bg-amber-50/50">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Lock className="h-4 w-4 text-amber-600" />
            <CardTitle className="text-sm font-medium">Admin Notes</CardTitle>
            <span className="text-xs text-muted-foreground">(not visible to client)</span>
          </div>
        </CardHeader>
        <CardContent>
          <textarea
            value={adminNotes}
            onChange={(e) => setAdminNotes(e.target.value)}
            rows={4}
            className="w-full rounded-md border bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            placeholder="Private assessment notes..."
          />
        </CardContent>
      </Card>

      {/* Client's Additional Notes (read-only) */}
      {intake.additionalNotes && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Additional Client Notes</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="whitespace-pre-wrap text-sm text-muted-foreground">
              {intake.additionalNotes}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Save button */}
      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={isPending}>
          <Save className="mr-2 h-4 w-4" />
          {isPending ? "Saving..." : "Save Changes"}
        </Button>
      </div>
    </div>
  );
}
