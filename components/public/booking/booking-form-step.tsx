"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import type { BookingData } from "./booking-widget";

interface BookingFormStepProps {
  readonly initialData: BookingData;
  readonly onSubmit: (info: {
    clientName: string;
    clientEmail: string;
    clientPhone: string;
    clientNotes: string;
  }) => void;
  readonly onBack: () => void;
}

export function BookingFormStep({
  initialData,
  onSubmit,
  onBack,
}: BookingFormStepProps) {
  const [name, setName] = useState(initialData.clientName);
  const [email, setEmail] = useState(initialData.clientEmail);
  const [phone, setPhone] = useState(initialData.clientPhone);
  const [notes, setNotes] = useState(initialData.clientNotes);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (name.trim().length < 2) {
      toast.error("Please enter your name");
      return;
    }
    if (!email.includes("@")) {
      toast.error("Please enter a valid email address");
      return;
    }

    onSubmit({
      clientName: name.trim(),
      clientEmail: email.trim(),
      clientPhone: phone.trim(),
      clientNotes: notes.trim(),
    });
  }

  return (
    <div className="space-y-4">
      <div className="text-center">
        <h2 className="font-heading text-xl font-bold">Your Details</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Please provide your contact information.
        </p>
      </div>

      <form
        onSubmit={handleSubmit}
        className="mx-auto max-w-md space-y-4"
      >
        <div className="space-y-2">
          <Label htmlFor="clientName">Full Name *</Label>
          <Input
            id="clientName"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your full name"
            required
            minLength={2}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="clientEmail">Email Address *</Label>
          <Input
            id="clientEmail"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="your@email.com"
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="clientPhone">
            Phone Number{" "}
            <span className="text-muted-foreground">(optional)</span>
          </Label>
          <Input
            id="clientPhone"
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+27..."
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="clientNotes">
            Anything you&rsquo;d like me to know?{" "}
            <span className="text-muted-foreground">(optional)</span>
          </Label>
          <Textarea
            id="clientNotes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Any goals, concerns, or context for your session..."
            rows={3}
            maxLength={1000}
          />
        </div>

        <div className="flex justify-between pt-2">
          <Button type="button" variant="ghost" onClick={onBack}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
          <Button type="submit">
            Review Booking
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </form>
    </div>
  );
}
