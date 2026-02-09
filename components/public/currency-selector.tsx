"use client";

import { useRegion } from "@/lib/region-store";
import { REGION_CONFIG, type Currency } from "@/lib/region";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const CURRENCY_LABELS: Record<Currency, string> = {
  ZAR: "R ZAR",
  USD: "$ USD",
  EUR: "€ EUR",
  GBP: "£ GBP",
};

export function CurrencySelector() {
  const { region, currency, setCurrency, isInternational } = useRegion();

  if (!isInternational) return null;

  const available = REGION_CONFIG[region].currencies;

  return (
    <Select value={currency} onValueChange={(v) => setCurrency(v as Currency)}>
      <SelectTrigger className="h-8 w-[90px] text-xs border-muted">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {available.map((c) => (
          <SelectItem key={c} value={c} className="text-xs">
            {CURRENCY_LABELS[c]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
