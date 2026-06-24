import { prisma } from "@/lib/prisma";

export async function logCalendarOp(params: {
  bookingId?: string;
  seriesId?: string;
  operation: "create" | "delete" | "delete_occurrence" | "resync" | "reconcile";
  status: "success" | "failed" | "partial";
  graphEventId?: string;
  errorMessage?: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  try {
    await prisma.calendarSyncLog.create({
      data: {
        bookingId: params.bookingId,
        seriesId: params.seriesId,
        operation: params.operation,
        status: params.status,
        graphEventId: params.graphEventId,
        errorMessage: params.errorMessage,
        metadata: params.metadata as never,
      },
    });
  } catch {
    // Logging should never break the main operation
    console.error("[CalendarSyncLog] Failed to write log:", params);
  }
}
