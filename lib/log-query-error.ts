/**
 * lib/log-query-error.ts — Lightweight error/null logging for critical Prisma queries
 *
 * Notes:  Use on critical paths (billing, calendar sync, emails) where a null
 *         result would cause downstream failures. Never throws, never blocks.
 *         Not for every query — only where silent failure has caused debugging pain.
 *
 * Usage:
 *   const student = await prisma.student.findUnique({ where: { id } });
 *   logQueryResult("billing:getStudent", student, { id });
 */

export function logQueryResult(
  label: string,
  result: unknown,
  context?: Record<string, unknown>,
): void {
  if (result === null || result === undefined) {
    console.warn(`[query] ${label} returned null/undefined`, context ?? "");
  }
}

export function logQueryError(
  label: string,
  error: unknown,
  context?: Record<string, unknown>,
): void {
  if (error) {
    console.error(`[query] ${label} failed:`, error, context ?? "");
  }
}
