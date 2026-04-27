"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { updateBookingStatus } from "./actions";

export function StaleQuickActions({ bookingId }: { bookingId: string }) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function markAs(status: "completed" | "no_show" | "cancelled") {
    startTransition(async () => {
      try {
        await updateBookingStatus(bookingId, status);
        toast.success(`Marked as ${status.replace("_", " ")}`);
        router.refresh();
      } catch {
        toast.error("Failed to update status");
      }
    });
  }

  return (
    <div className="flex items-center justify-end gap-1">
      <Button
        variant="ghost"
        size="sm"
        className="h-7 text-xs text-green-700 hover:bg-green-50 hover:text-green-800"
        onClick={() => markAs("completed")}
        disabled={isPending}
      >
        Complete
      </Button>
      <Button
        variant="ghost"
        size="sm"
        className="h-7 text-xs text-orange-700 hover:bg-orange-50 hover:text-orange-800"
        onClick={() => markAs("no_show")}
        disabled={isPending}
      >
        No Show
      </Button>
      <Button
        variant="ghost"
        size="sm"
        className="h-7 text-xs text-red-700 hover:bg-red-50 hover:text-red-800"
        onClick={() => markAs("cancelled")}
        disabled={isPending}
      >
        Cancel
      </Button>
    </div>
  );
}
