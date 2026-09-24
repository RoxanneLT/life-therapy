"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { ToggleChipGrid } from "@/components/ui/toggle-chip-grid";
import { ALLOWED_SLOT_START_TIMES } from "@/lib/booking-config";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { createAvailabilityOverride } from "@/app/(admin)/admin/(dashboard)/bookings/availability/actions";

/** The three shapes an override can take. The server reads the same three words. */
type Mode = "blocked" | "hours" | "slots";

export function AvailabilityOverrideForm() {
  const [saving, setSaving] = useState(false);
  const [mode, setMode] = useState<Mode>("blocked");
  const [openSlots, setOpenSlots] = useState<string[]>([]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);

    try {
      const formData = new FormData(e.currentTarget);
      formData.set("mode", mode);
      formData.set("openSlots", openSlots.join(","));
      const result = await createAvailabilityOverride(formData);
      if (result?.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Availability override saved");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to save override"
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Add Override</CardTitle>
        <CardDescription>
          Block a day off or set custom hours for a specific date.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="date">Date</Label>
            <Input id="date" name="date" type="date" required />
          </div>

          <RadioGroup
            value={mode}
            onValueChange={(v) => setMode(v as Mode)}
            className="gap-3"
          >
            <div className="flex items-start gap-3">
              <RadioGroupItem value="blocked" id="mode-blocked" className="mt-1" />
              <Label htmlFor="mode-blocked" className="font-normal">
                Block entire day
                <span className="block text-xs text-muted-foreground">
                  Nothing can be booked, whatever the usual hours are.
                </span>
              </Label>
            </div>
            <div className="flex items-start gap-3">
              <RadioGroupItem value="slots" id="mode-slots" className="mt-1" />
              <Label htmlFor="mode-slots" className="font-normal">
                Open chosen time slots
                <span className="block text-xs text-muted-foreground">
                  Opens a day that is normally closed — a weekend, a public holiday — at the
                  times you tick, and nothing else.
                </span>
              </Label>
            </div>
            <div className="flex items-start gap-3">
              <RadioGroupItem value="hours" id="mode-hours" className="mt-1" />
              <Label htmlFor="mode-hours" className="font-normal">
                Custom hours
                <span className="block text-xs text-muted-foreground">
                  Every slot inside an open and close time.
                </span>
              </Label>
            </div>
          </RadioGroup>

          {mode === "slots" && (
            <div className="space-y-2">
              <Label>Slots to open</Label>
              {/* The same fixed start times the booking engine offers — lib/booking-config.ts. */}
              <ToggleChipGrid
                options={ALLOWED_SLOT_START_TIMES.map((t) => ({ value: t, label: t }))}
                selected={openSlots}
                onChange={setOpenSlots}
              />
              <p className="text-xs text-muted-foreground">
                {openSlots.length === 0
                  ? "Tick at least one."
                  : `${openSlots.length} slot${openSlots.length === 1 ? "" : "s"} will be open. The day shows as unavailable once they are booked.`}
              </p>
            </div>
          )}

          {mode === "hours" && (
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="startTime">Open</Label>
                <Input
                  id="startTime"
                  name="startTime"
                  type="time"
                  defaultValue="09:00"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="endTime">Close</Label>
                <Input
                  id="endTime"
                  name="endTime"
                  type="time"
                  defaultValue="17:00"
                  required
                />
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="reason">
              Reason <span className="text-muted-foreground">(optional)</span>
            </Label>
            <Input
              id="reason"
              name="reason"
              placeholder="e.g. Public holiday, Annual leave"
            />
          </div>

          <Button type="submit" disabled={saving} className="w-full">
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save Override
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
