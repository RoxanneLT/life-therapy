"use client";

import { useState, useEffect, useTransition } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ToggleChipGrid } from "@/components/ui/toggle-chip-grid";
import {
  BEHAVIOUR_OPTIONS,
  FEELING_OPTIONS,
  SYMPTOM_OPTIONS,
} from "@/lib/intake-options";
import {
  convertToClientAction,
  getPackagesForConvertAction,
} from "../actions";
import { UserCheck, ChevronDown } from "lucide-react";

interface ClientData {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
}

interface IntakeData {
  behaviours: string[];
  feelings: string[];
  symptoms: string[];
}

interface PackageOption {
  id: string;
  title: string;
  credits: number;
  priceCents: number;
}

export function ConvertDialog({
  client,
  existingIntake,
}: {
  client: ClientData;
  existingIntake?: IntakeData | null;
}) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [packages, setPackages] = useState<PackageOption[]>([]);
  const [loadingPkgs, setLoadingPkgs] = useState(false);

  // Form state
  const [selectedPackageId, setSelectedPackageId] = useState<string>("");
  const [manualCredits, setManualCredits] = useState(0);
  const [adminNotes, setAdminNotes] = useState("");
  const [behaviours, setBehaviours] = useState<string[]>(
    existingIntake?.behaviours || []
  );
  const [feelings, setFeelings] = useState<string[]>(
    existingIntake?.feelings || []
  );
  const [symptoms, setSymptoms] = useState<string[]>(
    existingIntake?.symptoms || []
  );
  const [assessmentOpen, setAssessmentOpen] = useState(false);
  const [error, setError] = useState("");

  // Load packages when dialog opens
  useEffect(() => {
    if (open && packages.length === 0) {
      setLoadingPkgs(true);
      getPackagesForConvertAction()
        .then(setPackages)
        .catch(() => {})
        .finally(() => setLoadingPkgs(false));
    }
  }, [open, packages.length]);

  const selectedPkg = packages.find((p) => p.id === selectedPackageId);
  const creditsToGrant = selectedPkg ? selectedPkg.credits : manualCredits;

  function handleSubmit() {
    setError("");
    startTransition(async () => {
      try {
        await convertToClientAction(client.id, {
          hybridPackageId: selectedPackageId || undefined,
          credits: selectedPackageId ? undefined : manualCredits || undefined,
          adminNotes: adminNotes.trim() || undefined,
          behaviours: behaviours.length > 0 ? behaviours : undefined,
          feelings: feelings.length > 0 ? feelings : undefined,
          symptoms: symptoms.length > 0 ? symptoms : undefined,
        });
        setOpen(false);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to convert client"
        );
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="gap-1.5">
          <UserCheck className="h-4 w-4" />
          Convert to Client
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Convert to Active Client</DialogTitle>
        </DialogHeader>

        <div className="space-y-5">
          {/* Client info (read-only) */}
          <div className="rounded-md border bg-muted/30 p-3">
            <p className="text-sm font-medium">
              {client.firstName} {client.lastName}
            </p>
            <p className="text-sm text-muted-foreground">{client.email}</p>
            {client.phone && (
              <p className="text-sm text-muted-foreground">{client.phone}</p>
            )}
          </div>

          {/* Package selection */}
          <div className="space-y-2">
            <Label>Package</Label>
            <Select
              value={selectedPackageId}
              onValueChange={setSelectedPackageId}
              disabled={loadingPkgs}
            >
              <SelectTrigger>
                <SelectValue
                  placeholder={loadingPkgs ? "Loading..." : "No package"}
                />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No package</SelectItem>
                {packages.map((pkg) => (
                  <SelectItem key={pkg.id} value={pkg.id}>
                    {pkg.title}
                    {pkg.credits > 0 ? ` (${pkg.credits} credits)` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Credits — auto from package or manual */}
          {selectedPackageId && selectedPkg ? (
            <div className="rounded-md border bg-green-50 p-3">
              <p className="text-sm font-medium text-green-800">
                {selectedPkg.credits} session credit
                {selectedPkg.credits !== 1 ? "s" : ""} will be granted
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              <Label htmlFor="manualCredits">Credits to Grant</Label>
              <Input
                id="manualCredits"
                type="number"
                min={0}
                max={20}
                value={manualCredits}
                onChange={(e) =>
                  setManualCredits(parseInt(e.target.value, 10) || 0)
                }
              />
              <p className="text-xs text-muted-foreground">
                Optional. Leave at 0 for no credits.
              </p>
            </div>
          )}

          {/* Quick assessment (collapsible) */}
          <div className="rounded-md border">
            <button
              type="button"
              onClick={() => setAssessmentOpen(!assessmentOpen)}
              className="flex w-full items-center justify-between px-3 py-2.5 text-sm font-medium hover:bg-muted/50"
            >
              <span>
                Quick Assessment
                {behaviours.length + feelings.length + symptoms.length > 0 && (
                  <span className="ml-1.5 text-xs text-muted-foreground">
                    ({behaviours.length + feelings.length + symptoms.length}{" "}
                    selected)
                  </span>
                )}
              </span>
              <ChevronDown
                className={`h-4 w-4 transition-transform ${assessmentOpen ? "rotate-180" : ""}`}
              />
            </button>
            {assessmentOpen && (
              <div className="space-y-4 border-t px-3 py-3">
                <div>
                  <p className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Behaviours
                  </p>
                  <ToggleChipGrid
                    options={BEHAVIOUR_OPTIONS}
                    selected={behaviours}
                    onChange={setBehaviours}
                  />
                </div>
                <div>
                  <p className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Feelings
                  </p>
                  <ToggleChipGrid
                    options={FEELING_OPTIONS}
                    selected={feelings}
                    onChange={setFeelings}
                  />
                </div>
                <div>
                  <p className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Symptoms
                  </p>
                  <ToggleChipGrid
                    options={SYMPTOM_OPTIONS}
                    selected={symptoms}
                    onChange={setSymptoms}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Admin notes */}
          <div className="space-y-2">
            <Label htmlFor="convertNotes">Admin Notes</Label>
            <textarea
              id="convertNotes"
              value={adminNotes}
              onChange={(e) => setAdminNotes(e.target.value)}
              rows={3}
              className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              placeholder="Notes about the consultation..."
            />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <DialogClose asChild>
            <Button variant="outline" disabled={isPending}>
              Cancel
            </Button>
          </DialogClose>
          <Button onClick={handleSubmit} disabled={isPending}>
            {isPending ? "Converting..." : "Convert to Active Client"}
            {creditsToGrant > 0 && !isPending && (
              <span className="ml-1 text-xs opacity-75">
                (+{creditsToGrant} credits)
              </span>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
