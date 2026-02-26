"use client";

import { SESSION_TYPES, type SessionTypeConfig } from "@/lib/booking-config";
import { formatPrice } from "@/lib/utils";
import type { Currency } from "@/lib/region";
import { Card, CardContent } from "@/components/ui/card";
import { Clock } from "lucide-react";

interface SessionTypeStepProps {
  readonly onSelect: (config: SessionTypeConfig) => void;
  readonly sessionPrices: Record<string, number>;
  readonly currency: Currency;
  readonly excludeTypes?: string[];
}

export function SessionTypeStep({ onSelect, sessionPrices, currency, excludeTypes }: SessionTypeStepProps) {
  const types = excludeTypes
    ? SESSION_TYPES.filter((t) => !excludeTypes.includes(t.type))
    : SESSION_TYPES;

  return (
    <div className="space-y-4">
      <div className="text-center">
        <h2 className="font-heading text-xl font-bold">Choose Your Session</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Select the type of session you&rsquo;d like to book.
        </p>
      </div>
      <div className={`mx-auto grid grid-cols-1 gap-4 ${types.length >= 3 ? "sm:grid-cols-3" : "max-w-2xl sm:grid-cols-2"}`}>
        {types.map((config) => (
          <Card
            key={config.type}
            role="button"
            tabIndex={0}
            className="cursor-pointer transition-all hover:shadow-md hover:border-brand-300"
            onClick={() => onSelect(config)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onSelect(config);
              }
            }}
          >
            <CardContent className="flex flex-col items-center p-6 text-center">
              <h3 className="font-heading text-lg font-semibold">
                {config.label}
              </h3>
              <p className="mt-2 text-sm text-muted-foreground">
                {config.description}
              </p>
              <div className="mt-4 flex items-center gap-4 text-sm">
                <span className="flex items-center gap-1 text-muted-foreground">
                  <Clock className="h-4 w-4" />
                  {config.durationMinutes} min
                </span>
                <span className="font-semibold text-brand-700">
                  {config.isFree
                    ? "Free"
                    : formatPrice(sessionPrices[config.type] ?? 0, currency)}
                </span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
