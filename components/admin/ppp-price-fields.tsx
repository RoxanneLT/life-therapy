"use client";

import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

// PPP divisors derived from existing session pricing ratios
const PPP_DIVISORS = { USD: 13, EUR: 14, GBP: 17 } as const;

/** Beautify a cents value to end in 99 (e.g. 4576 → 4599, 320 → 299) */
function beautify(cents: number): number {
  if (cents <= 0) return 0;
  const rounded = Math.round(cents / 100) * 100;
  return Math.max(99, rounded - 1); // minimum 99 cents ($0.99)
}

function suggest(zarCents: number): { usd: number; eur: number; gbp: number } {
  if (!zarCents || zarCents <= 0) return { usd: 0, eur: 0, gbp: 0 };
  return {
    usd: beautify(zarCents / PPP_DIVISORS.USD),
    eur: beautify(zarCents / PPP_DIVISORS.EUR),
    gbp: beautify(zarCents / PPP_DIVISORS.GBP),
  };
}

interface PppPriceFieldsProps {
  /** The four hidden-input names submitted with the form */
  readonly names: {
    zar: string;
    usd: string;
    eur: string;
    gbp: string;
  };
  readonly defaultZar?: number;
  readonly defaultUsd?: number | null;
  readonly defaultEur?: number | null;
  readonly defaultGbp?: number | null;
  readonly zarRequired?: boolean;
}

export function PppPriceFields({
  names,
  defaultZar = 0,
  defaultUsd,
  defaultEur,
  defaultGbp,
  zarRequired = true,
}: PppPriceFieldsProps) {
  const [zar, setZar] = useState(defaultZar);
  const [usd, setUsd] = useState<number | string>(defaultUsd ?? "");
  const [eur, setEur] = useState<number | string>(defaultEur ?? "");
  const [gbp, setGbp] = useState<number | string>(defaultGbp ?? "");

  // Auto-fill international prices whenever ZAR changes
  // Skip the initial render (keep existing values for edits)
  const [initialized, setInitialized] = useState(false);
  useEffect(() => {
    if (!initialized) {
      setInitialized(true);
      return;
    }
    const s = suggest(zar);
    setUsd(s.usd || "");
    setEur(s.eur || "");
    setGbp(s.gbp || "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zar]);

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <div className="space-y-2">
        <Label htmlFor={names.zar}>Price (ZAR cents)</Label>
        <Input
          id={names.zar}
          name={names.zar}
          type="number"
          value={zar}
          onChange={(e) => setZar(Number(e.target.value) || 0)}
          min={0}
          required={zarRequired}
        />
        {zar > 0 && (
          <p className="text-xs text-muted-foreground">
            = R{(zar / 100).toFixed(2)}
          </p>
        )}
      </div>
      <div className="space-y-2">
        <Label htmlFor={names.usd}>Price (USD cents)</Label>
        <Input
          id={names.usd}
          name={names.usd}
          type="number"
          value={usd}
          onChange={(e) => setUsd(e.target.value === "" ? "" : Number(e.target.value))}
          min={0}
          placeholder="e.g. 2499"
        />
        {usd && Number(usd) > 0 && (
          <p className="text-xs text-muted-foreground">
            = ${(Number(usd) / 100).toFixed(2)}
          </p>
        )}
      </div>
      <div className="space-y-2">
        <Label htmlFor={names.eur}>Price (EUR cents)</Label>
        <Input
          id={names.eur}
          name={names.eur}
          type="number"
          value={eur}
          onChange={(e) => setEur(e.target.value === "" ? "" : Number(e.target.value))}
          min={0}
          placeholder="e.g. 2199"
        />
        {eur && Number(eur) > 0 && (
          <p className="text-xs text-muted-foreground">
            = &euro;{(Number(eur) / 100).toFixed(2)}
          </p>
        )}
      </div>
      <div className="space-y-2">
        <Label htmlFor={names.gbp}>Price (GBP cents)</Label>
        <Input
          id={names.gbp}
          name={names.gbp}
          type="number"
          value={gbp}
          onChange={(e) => setGbp(e.target.value === "" ? "" : Number(e.target.value))}
          min={0}
          placeholder="e.g. 1899"
        />
        {gbp && Number(gbp) > 0 && (
          <p className="text-xs text-muted-foreground">
            = &pound;{(Number(gbp) / 100).toFixed(2)}
          </p>
        )}
      </div>
    </div>
  );
}
