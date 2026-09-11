// Its own module because a CLIENT component imports it. Until 2026-09-11 it lived in
// lib/admin/client-insights.ts, which imports Prisma: the import pulled the Postgres driver into the
// browser bundle, and `next build` failed on every push from 566617e (2026-08-19) on. tsc, ESLint and
// the audit all passed it; only the production build can see a server module in a client graph.
// Keep this file free of server imports.

export function getRateLabel(rate: number): {
  label: string;
  color: "green" | "amber" | "red";
} {
  if (rate <= 10) return { label: "Very low", color: "green" };
  if (rate <= 20) return { label: "Low", color: "green" };
  if (rate <= 35) return { label: "Moderate", color: "amber" };
  return { label: "High", color: "red" };
}
