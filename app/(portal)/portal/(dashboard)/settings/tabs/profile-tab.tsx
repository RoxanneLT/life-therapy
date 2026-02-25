"use client";

import { useState, useTransition } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Check } from "lucide-react";

const GENDER_OPTIONS = ["Female", "Male", "Non-binary", "Prefer not to say"];
const RELATIONSHIP_OPTIONS = ["Single", "In a relationship", "Married", "Divorced", "Widowed", "Prefer not to say"];
import { updateProfileAction } from "../actions";

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

interface ProfileTabProps {
  readonly student: StudentData;
}

export function ProfileTab({ student }: ProfileTabProps) {
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
              <Select name="gender" defaultValue={student.gender || ""}>
                <SelectTrigger id="gender">
                  <SelectValue placeholder="Select gender" />
                </SelectTrigger>
                <SelectContent>
                  {GENDER_OPTIONS.map((g) => (
                    <SelectItem key={g} value={g}>{g}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="relationshipStatus">Relationship Status</Label>
              <Select name="relationshipStatus" defaultValue={student.relationshipStatus || ""}>
                <SelectTrigger id="relationshipStatus">
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  {RELATIONSHIP_OPTIONS.map((r) => (
                    <SelectItem key={r} value={r}>{r}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
