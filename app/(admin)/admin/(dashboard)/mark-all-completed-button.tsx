"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { CheckCircle } from "lucide-react";
import { toast } from "sonner";
import { markStaleSessionsCompletedAction } from "./bookings/actions";

export function MarkAllCompletedButton({ count }: { count: number }) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function handleClick() {
    startTransition(async () => {
      const result = await markStaleSessionsCompletedAction();
      toast.success(
        `${result.count} session${result.count !== 1 ? "s" : ""} marked as completed`,
      );
      router.refresh();
    });
  }

  return (
    <Button size="sm" onClick={handleClick} disabled={isPending}>
      <CheckCircle className="mr-1.5 h-3.5 w-3.5" />
      {isPending ? "Marking..." : `Mark All Completed (${count})`}
    </Button>
  );
}
