"use client";

import { useState, useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { SessionTypeStep } from "./session-type-step";
import { DateTimeStep } from "./date-time-step";
import { BookingFormStep } from "./booking-form-step";
import { BookingReviewStep } from "./booking-review-step";
import { SESSION_TYPES, type SessionTypeConfig } from "@/lib/booking-config";
import { formatPrice } from "@/lib/utils";
import type { TimeSlot } from "@/lib/availability";
import type { Currency } from "@/lib/region";
import { Clock } from "lucide-react";

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
  "Date & Time",
  "Your Details",
  "Confirm",
] as const;

interface BookingWidgetProps {
  readonly creditBalance?: number;
  readonly sessionPrices: Record<string, number>;
  readonly currency: Currency;
}

export function BookingWidget({ creditBalance = 0, sessionPrices, currency }: BookingWidgetProps) {
  const searchParams = useSearchParams();
  const widgetRef = useRef<HTMLElement>(null);
  const hasAppliedUrlParam = useRef(false);
  const [step, setStep] = useState(0);
  const [preselected, setPreselected] = useState(false);
  const [data, setData] = useState<BookingData>({
    sessionType: null,
    date: null,
    slot: null,
    clientName: "",
    clientEmail: "",
    clientPhone: "",
    clientNotes: "",
  });

  // Pre-select session type from URL param (once only) and auto-scroll
  useEffect(() => {
    if (hasAppliedUrlParam.current) return;
    const typeParam = searchParams.get("type");
    if (typeParam) {
      const match = SESSION_TYPES.find((t) => t.type === typeParam);
      if (match) {
        hasAppliedUrlParam.current = true;
        setData((d) => ({ ...d, sessionType: match }));
        setStep(1);
        setPreselected(true);
        // Auto-scroll to widget after a brief delay for render
        setTimeout(() => {
          widgetRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
        }, 100);
      }
    }
  }, [searchParams]);

  function goBack() {
    if (step === 1 && preselected) {
      setPreselected(false);
    }
    setStep((s) => Math.max(s - 1, 0));
  }

  function selectSessionType(config: SessionTypeConfig) {
    setData((d) => ({ ...d, sessionType: config, date: null, slot: null }));
    setPreselected(false);
    setStep(1);
  }

  function changeSessionType() {
    setData((d) => ({ ...d, sessionType: null, date: null, slot: null }));
    setPreselected(false);
    setStep(0);
  }

  function selectDateTime(date: string, slot: TimeSlot) {
    setData((d) => ({ ...d, date, slot }));
    setStep(2);
  }

  function updateClientInfo(info: {
    clientName: string;
    clientEmail: string;
    clientPhone: string;
    clientNotes: string;
  }) {
    setData((d) => ({ ...d, ...info }));
    setStep(3);
  }

  return (
    <section ref={widgetRef} className="container mx-auto max-w-3xl px-4 py-12 scroll-mt-20">
      {/* Session type badge — shown when a type is selected and we're past step 0 */}
      {data.sessionType && step > 0 && (
        <div className="mb-6 flex items-center justify-center gap-3 rounded-lg border border-brand-200 bg-brand-50/50 px-4 py-3 dark:border-brand-800 dark:bg-brand-950/30">
          <div className="flex items-center gap-2 sm:gap-4 text-sm">
            <span className="font-semibold text-brand-700 dark:text-brand-300">
              {data.sessionType.label}
            </span>
            <span className="flex items-center gap-1 text-muted-foreground">
              <Clock className="h-3.5 w-3.5" />
              {data.sessionType.durationMinutes} min
            </span>
            <span className="text-muted-foreground">
              {data.sessionType.isFree
                ? "Free"
                : formatPrice(sessionPrices[data.sessionType.type] ?? 0, currency)}
            </span>
          </div>
          <button
            onClick={changeSessionType}
            className="text-xs text-brand-600 underline hover:text-brand-800 dark:text-brand-400 dark:hover:text-brand-200"
          >
            Change
          </button>
        </div>
      )}

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
      {step === 0 && <SessionTypeStep onSelect={selectSessionType} sessionPrices={sessionPrices} currency={currency} />}
      {step === 1 && data.sessionType && (
        <DateTimeStep
          sessionType={data.sessionType}
          onSelect={selectDateTime}
          onBack={goBack}
        />
      )}
      {step === 2 && (
        <BookingFormStep
          initialData={data}
          onSubmit={updateClientInfo}
          onBack={goBack}
        />
      )}
      {step === 3 && data.sessionType && data.date && data.slot && (
        <BookingReviewStep data={data} onBack={goBack} creditBalance={creditBalance} sessionPrices={sessionPrices} currency={currency} />
      )}
    </section>
  );
}
