"use client";

import { useState } from "react";
import { SessionTypeStep } from "@/components/public/booking/session-type-step";
import { DateTimeStep } from "@/components/public/booking/date-time-step";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  ArrowLeft,
  Loader2,
  CalendarDays,
  Clock,
  User,
  Mail,
  Coins,
  Users,
  AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";
import { format, parse } from "date-fns";
import { formatPrice, cn } from "@/lib/utils";
import type { SessionTypeConfig } from "@/lib/booking-config";
import type { TimeSlot } from "@/lib/availability";
import type { Currency } from "@/lib/region";
import { createPortalBooking } from "./actions";

const STEPS = ["Choose Session", "Date & Time", "Confirm"] as const;

function stepClassName(i: number, current: number): string {
  if (i === current) return "bg-brand-600 text-white";
  if (i < current) return "bg-brand-100 text-brand-700 hover:bg-brand-200 cursor-pointer";
  return "bg-muted text-muted-foreground";
}

interface PortalBookingWidgetProps {
  readonly creditBalance: number;
  readonly sessionPrices: Record<string, number>;
  readonly currency: Currency;
  readonly studentName: string;
  readonly studentEmail: string;
  readonly partner: { name: string; email: string } | null;
  readonly hideFreeConsultation?: boolean;
}

export function PortalBookingWidget({
  creditBalance,
  sessionPrices,
  currency,
  studentName,
  studentEmail,
  partner,
  hideFreeConsultation,
}: PortalBookingWidgetProps) {
  const [step, setStep] = useState(0);
  const [sessionType, setSessionType] = useState<SessionTypeConfig | null>(null);
  const [date, setDate] = useState<string | null>(null);
  const [slot, setSlot] = useState<TimeSlot | null>(null);
  const [clientNotes, setClientNotes] = useState("");
  const [useCredit, setUseCredit] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Couples partner state (for when no partner is linked)
  const [partnerName, setPartnerName] = useState("");
  const [partnerEmail, setPartnerEmail] = useState("");
  const [partnerPhone, setPartnerPhone] = useState("");

  const isCouples = sessionType?.type === "couples";
  const hasPartner = partner !== null;

  function handleSessionTypeSelect(config: SessionTypeConfig) {
    setSessionType(config);
    setStep(1);
  }

  function handleDateTimeSelect(selectedDate: string, selectedSlot: TimeSlot) {
    setDate(selectedDate);
    setSlot(selectedSlot);
    setStep(2);
  }

  async function handleConfirm() {
    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.set("sessionType", sessionType!.type);
      formData.set("date", date!);
      formData.set("startTime", slot!.start);
      if (clientNotes) formData.set("clientNotes", clientNotes);
      if (useCredit) formData.set("useSessionCredit", "true");
      if (isCouples && !hasPartner && partnerName) {
        formData.set("partnerName", partnerName);
        formData.set("partnerEmail", partnerEmail);
        formData.set("partnerPhone", partnerPhone);
      }

      await createPortalBooking(formData);
      // redirect happens in the server action
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Booking failed. Please try again."
      );
      setSubmitting(false);
    }
  }

  const priceCents = sessionType ? (sessionPrices[sessionType.type] ?? 0) : 0;
  const priceLabel = sessionType?.isFree ? "Free" : formatPrice(priceCents, currency);
  const canUseCredit = creditBalance > 0 && sessionType && !sessionType.isFree;

  return (
    <div className="space-y-6">
      {/* Step indicator */}
      <div className="flex items-center justify-center gap-2">
        {STEPS.map((label, i) => (
          <div key={label} className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => { if (i < step) setStep(i); }}
              disabled={i > step}
              className={cn(
                "flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-colors",
                stepClassName(i, step),
              )}
            >
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white/20 text-[10px]">
                {i + 1}
              </span>
              {label}
            </button>
            {i < STEPS.length - 1 && (
              <div className="h-px w-6 bg-border" />
            )}
          </div>
        ))}
      </div>

      {/* Step 0: Choose Session */}
      {step === 0 && (
        <SessionTypeStep
          onSelect={handleSessionTypeSelect}
          sessionPrices={sessionPrices}
          currency={currency}
          excludeTypes={hideFreeConsultation ? ["free_consultation"] : undefined}
        />
      )}

      {/* Step 1: Date & Time */}
      {step === 1 && sessionType && (
        <DateTimeStep
          sessionType={sessionType}
          onSelect={handleDateTimeSelect}
          onBack={() => setStep(0)}
        />
      )}

      {/* Step 2: Review & Confirm */}
      {step === 2 && sessionType && date && slot && (
        <div className="space-y-4">
          <div className="text-center">
            <h2 className="font-heading text-xl font-bold">
              Confirm Your Booking
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Review the details below and confirm.
            </p>
          </div>

          <Card className="mx-auto max-w-md">
            <CardHeader>
              <CardTitle>{sessionType.label}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-3">
                <CalendarDays className="h-4 w-4 text-muted-foreground" />
                <span>{format(parse(date, "yyyy-MM-dd", new Date()), "EEEE, d MMMM yyyy")}</span>
              </div>
              <Separator />
              <div className="flex items-center gap-3">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <span>
                  {slot.start} – {slot.end} ({sessionType.durationMinutes} min)
                </span>
              </div>
              <Separator />
              <div className="flex items-center gap-3">
                <User className="h-4 w-4 text-muted-foreground" />
                <span>{studentName}</span>
              </div>
              <Separator />
              <div className="flex items-center gap-3">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <span>{studentEmail}</span>
              </div>

              {/* Couples partner section */}
              {isCouples && (
                <>
                  <Separator />
                  {hasPartner ? (
                    <div className="flex items-center gap-3">
                      <Users className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <span className="font-medium">{partner.name}</span>
                        <span className="ml-2 text-sm text-muted-foreground">{partner.email}</span>
                      </div>
                    </div>
                  ) : (
                    <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-950/30">
                      <div className="flex items-start gap-2">
                        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                        <div className="space-y-3 flex-1">
                          <div>
                            <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
                              No linked partner
                            </p>
                            <p className="text-xs text-amber-700 dark:text-amber-300">
                              Add your partner&apos;s details so they can receive the session invite.
                            </p>
                          </div>
                          <div className="space-y-2">
                            <div>
                              <Label htmlFor="partnerName" className="text-xs">Partner&apos;s Name *</Label>
                              <Input
                                id="partnerName"
                                value={partnerName}
                                onChange={(e) => setPartnerName(e.target.value)}
                                placeholder="Full name"
                                className="mt-1 bg-white dark:bg-background"
                              />
                            </div>
                            <div>
                              <Label htmlFor="partnerEmail" className="text-xs">Partner&apos;s Email *</Label>
                              <Input
                                id="partnerEmail"
                                type="email"
                                value={partnerEmail}
                                onChange={(e) => setPartnerEmail(e.target.value)}
                                placeholder="partner@example.com"
                                className="mt-1 bg-white dark:bg-background"
                              />
                            </div>
                            <div>
                              <Label htmlFor="partnerPhone" className="text-xs">Partner&apos;s Phone</Label>
                              <Input
                                id="partnerPhone"
                                type="tel"
                                value={partnerPhone}
                                onChange={(e) => setPartnerPhone(e.target.value)}
                                placeholder="Optional"
                                className="mt-1 bg-white dark:bg-background"
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </>
              )}

              {/* Notes */}
              <Separator />
              <div>
                <Label htmlFor="clientNotes" className="text-sm text-muted-foreground">
                  Anything you&apos;d like to discuss? (optional)
                </Label>
                <Textarea
                  id="clientNotes"
                  value={clientNotes}
                  onChange={(e) => setClientNotes(e.target.value)}
                  placeholder="Topics, goals, or anything you'd like your therapist to know..."
                  rows={3}
                  maxLength={1000}
                  className="mt-1"
                />
              </div>
              <Separator />

              {/* Session credit toggle */}
              {canUseCredit && (
                <>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={useCredit}
                    aria-label="Use session credit"
                    onClick={() => setUseCredit(!useCredit)}
                    className="flex w-full items-center justify-between rounded-md border p-3 text-sm transition-colors hover:bg-muted"
                  >
                    <div className="flex items-center gap-2">
                      <Coins className="h-4 w-4 text-amber-500" />
                      <span>Use 1 Session Credit</span>
                      <span className="text-xs text-muted-foreground">
                        ({creditBalance} available)
                      </span>
                    </div>
                    <div
                      className={`h-5 w-9 rounded-full transition-colors ${
                        useCredit ? "bg-brand-500" : "bg-muted-foreground/30"
                      }`}
                    >
                      <div
                        className={`h-5 w-5 rounded-full bg-white shadow transition-transform ${
                          useCredit ? "translate-x-4" : "translate-x-0"
                        }`}
                      />
                    </div>
                  </button>
                  <Separator />
                </>
              )}

              <div className="flex justify-between font-semibold">
                <span>Total</span>
                <span className="text-brand-700">
                  {useCredit ? (
                    <span className="flex items-center gap-1">
                      <span className="text-muted-foreground line-through">{priceLabel}</span>
                      <span className="text-green-600">1 Credit</span>
                    </span>
                  ) : (
                    priceLabel
                  )}
                </span>
              </div>
              {!useCredit && !sessionType.isFree && (
                <p className="text-xs text-muted-foreground">
                  Payment details will be sent to you after booking.
                </p>
              )}
              {useCredit && (
                <p className="text-xs text-green-600">
                  No payment required — session credit will be deducted.
                </p>
              )}
            </CardContent>
          </Card>

          <div className="mx-auto flex max-w-md justify-between pt-2">
            <Button variant="ghost" onClick={() => setStep(1)} disabled={submitting}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </Button>
            <Button
              onClick={handleConfirm}
              disabled={submitting || (isCouples && !hasPartner && (!partnerName || !partnerEmail))}
            >
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Confirm Booking
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
