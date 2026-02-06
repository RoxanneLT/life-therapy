"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { SessionTypeStep } from "./session-type-step";
import { DatePickerStep } from "./date-picker-step";
import { TimeSlotStep } from "./time-slot-step";
import { BookingFormStep } from "./booking-form-step";
import { BookingReviewStep } from "./booking-review-step";
import { SESSION_TYPES, type SessionTypeConfig } from "@/lib/booking-config";
import type { TimeSlot } from "@/lib/availability";

export interface BookingData {
  sessionType: SessionTypeConfig | null;
  date: string | null; // "2026-02-10"
  slot: TimeSlot | null;
  clientName: string;
  clientEmail: string;
  clientPhone: string;
  clientNotes: string;
}

const STEPS = [
  "Choose Session",
  "Select Date",
  "Select Time",
  "Your Details",
  "Confirm",
] as const;

export function BookingWidget() {
  const searchParams = useSearchParams();
  const [step, setStep] = useState(0);
  const [data, setData] = useState<BookingData>({
    sessionType: null,
    date: null,
    slot: null,
    clientName: "",
    clientEmail: "",
    clientPhone: "",
    clientNotes: "",
  });

  // Pre-select session type from URL param (e.g. /book?type=free_consultation)
  useEffect(() => {
    const typeParam = searchParams.get("type");
    if (typeParam && !data.sessionType) {
      const match = SESSION_TYPES.find((t) => t.type === typeParam);
      if (match) {
        setData((d) => ({ ...d, sessionType: match }));
        setStep(1);
      }
    }
  }, [searchParams, data.sessionType]);

  function goNext() {
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
  }

  function goBack() {
    setStep((s) => Math.max(s - 1, 0));
  }

  function selectSessionType(config: SessionTypeConfig) {
    setData((d) => ({ ...d, sessionType: config, date: null, slot: null }));
    goNext();
  }

  function selectDate(date: string) {
    setData((d) => ({ ...d, date, slot: null }));
    goNext();
  }

  function selectSlot(slot: TimeSlot) {
    setData((d) => ({ ...d, slot }));
    goNext();
  }

  function updateClientInfo(info: {
    clientName: string;
    clientEmail: string;
    clientPhone: string;
    clientNotes: string;
  }) {
    setData((d) => ({ ...d, ...info }));
    goNext();
  }

  return (
    <section className="container mx-auto max-w-3xl px-4 py-12">
      {/* Progress indicator */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          {STEPS.map((label, i) => (
            <div key={label} className="flex flex-1 items-center">
              <div className="flex flex-col items-center">
                <div
                  className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold transition-colors ${
                    i <= step
                      ? "bg-brand-600 text-white"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  {i + 1}
                </div>
                <span className="mt-1 hidden text-xs sm:block">{label}</span>
              </div>
              {i < STEPS.length - 1 && (
                <div
                  className={`mx-2 h-0.5 flex-1 transition-colors ${
                    i < step ? "bg-brand-600" : "bg-muted"
                  }`}
                />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Step content */}
      {step === 0 && <SessionTypeStep onSelect={selectSessionType} />}
      {step === 1 && data.sessionType && (
        <DatePickerStep
          sessionType={data.sessionType}
          onSelect={selectDate}
          onBack={goBack}
        />
      )}
      {step === 2 && data.sessionType && data.date && (
        <TimeSlotStep
          sessionType={data.sessionType}
          date={data.date}
          onSelect={selectSlot}
          onBack={goBack}
        />
      )}
      {step === 3 && (
        <BookingFormStep
          initialData={data}
          onSubmit={updateClientInfo}
          onBack={goBack}
        />
      )}
      {step === 4 && data.sessionType && data.date && data.slot && (
        <BookingReviewStep data={data} onBack={goBack} />
      )}
    </section>
  );
}
