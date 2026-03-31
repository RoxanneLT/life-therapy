"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Circle, XCircle, Ban, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { cancelSeriesAction } from "./actions";

interface SeriesBooking {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  status: string;
  clientName: string;
}

interface SeriesTimelineProps {
  seriesId: string;
  bookings: SeriesBooking[];
}

const statusConfig: Record<string, {
  icon: typeof CheckCircle2;
  color: string;
  dotColor: string;
  lineThrough: boolean;
}> = {
  completed: {
    icon: CheckCircle2,
    color: "text-green-600 dark:text-green-400",
    dotColor: "bg-green-500",
    lineThrough: false,
  },
  confirmed: {
    icon: Circle,
    color: "text-blue-600 dark:text-blue-400",
    dotColor: "bg-blue-500",
    lineThrough: false,
  },
  pending: {
    icon: Circle,
    color: "text-blue-600 dark:text-blue-400",
    dotColor: "bg-blue-500",
    lineThrough: false,
  },
  cancelled: {
    icon: XCircle,
    color: "text-red-500 dark:text-red-400",
    dotColor: "bg-red-500",
    lineThrough: true,
  },
  no_show: {
    icon: XCircle,
    color: "text-gray-400 dark:text-gray-500",
    dotColor: "bg-gray-400",
    lineThrough: false,
  },
};

const statusBadgeClasses: Record<string, string> = {
  completed: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
  confirmed: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  pending: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300",
  cancelled: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
  no_show: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
};

export function SeriesTimeline({ seriesId, bookings }: SeriesTimelineProps) {
  const [isPending, startTransition] = useTransition();
  const [cancelled, setCancelled] = useState(false);

  const futureActive = bookings.filter((b) => {
    const today = new Date().toISOString().slice(0, 10);
    return b.date >= today && (b.status === "confirmed" || b.status === "pending");
  });

  function handleCancelAll() {
    if (!confirm(`Cancel all ${futureActive.length} future session(s) in this series?`)) return;

    startTransition(async () => {
      try {
        const result = await cancelSeriesAction(seriesId);
        toast.success(`Cancelled ${result.cancelled} session${result.cancelled !== 1 ? "s" : ""}`);
        setCancelled(true);
      } catch (err) {
        toast.error("Failed to cancel series");
        console.error(err);
      }
    });
  }

  return (
    <div className="space-y-4">
      {/* Cancel all future button */}
      {futureActive.length > 0 && !cancelled && (
        <div className="flex items-center gap-3">
          <Button
            variant="destructive"
            size="sm"
            onClick={handleCancelAll}
            disabled={isPending}
          >
            {isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Ban className="mr-2 h-4 w-4" />
            )}
            Cancel All Future Sessions ({futureActive.length})
          </Button>
        </div>
      )}

      {/* Timeline */}
      <div className="relative ml-4">
        {/* Vertical line */}
        <div className="absolute left-3 top-0 bottom-0 w-px bg-border" />

        <div className="space-y-0">
          {bookings.map((booking) => {
            const config = statusConfig[booking.status] || statusConfig.pending;
            const Icon = config.icon;

            return (
              <Link
                key={booking.id}
                href={`/admin/bookings/${booking.id}`}
                className="group relative flex items-start gap-4 py-3 pl-2 pr-3 rounded-md hover:bg-muted/50 transition-colors"
              >
                {/* Timeline dot */}
                <div className="relative z-10 shrink-0">
                  <Icon className={`h-6 w-6 ${config.color}`} />
                </div>

                {/* Content */}
                <div className={`flex-1 min-w-0 ${config.lineThrough ? "line-through opacity-60" : ""}`}>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-sm">
                      {formatDate(booking.date)}
                    </span>
                    <span className="text-sm text-muted-foreground">
                      {booking.startTime} – {booking.endTime}
                    </span>
                    <Badge
                      variant="secondary"
                      className={`text-xs ${statusBadgeClasses[booking.status] || ""}`}
                    >
                      {booking.status.replace("_", " ")}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    {booking.clientName}
                  </p>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00");
  return d.toLocaleDateString("en-ZA", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}
