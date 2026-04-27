"use client";

import { QueryProvider } from "./query-provider";

export function AdminProviders({ children }: { children: React.ReactNode }) {
  return <QueryProvider>{children}</QueryProvider>;
}
