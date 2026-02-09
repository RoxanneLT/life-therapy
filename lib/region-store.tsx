"use client";

import {
  createContext,
  useContext,
  useCallback,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import type { Region, Currency } from "./region";
import { LT_CURRENCY_COOKIE } from "./region";

interface RegionContextValue {
  region: Region;
  currency: Currency;
  isInternational: boolean;
  setCurrency: (currency: Currency) => void;
}

const RegionContext = createContext<RegionContextValue>({
  region: "za",
  currency: "ZAR",
  isInternational: false,
  setCurrency: () => {},
});

export function RegionProvider({
  region,
  currency,
  children,
}: {
  region: Region;
  currency: Currency;
  children: ReactNode;
}) {
  const router = useRouter();

  const setCurrency = useCallback(
    (newCurrency: Currency) => {
      // Set cookie (1 year)
      document.cookie = `${LT_CURRENCY_COOKIE}=${newCurrency}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
      // Trigger server component re-render
      router.refresh();
    },
    [router]
  );

  return (
    <RegionContext.Provider
      value={{
        region,
        currency,
        isInternational: region === "int",
        setCurrency,
      }}
    >
      {children}
    </RegionContext.Provider>
  );
}

export function useRegion() {
  return useContext(RegionContext);
}
