"use client";

import { useState, useTransition } from "react";
import { format } from "date-fns";
import { Receipt, ChevronRight, MoreHorizontal, Eye, X, Ban, Plus, ChevronsUpDown } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { EmptyState } from "@/components/admin/empty-state";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { excludeFromBillingAction, cancelBookingFromBillingAction } from "./actions";
import { toast } from "sonner";

export interface UpcomingBooking {
  id: string;
  date: Date;
  sessionType: string;
  startTime: string;
  endTime: string;
  priceZarCents: number;
  billingNote: string | null;
  status: string;
  isLateCancel: boolean;
  student: {
    id: string;
    firstName: string;
    lastName: string;
    standingDiscountPercent: number | null;
    standingDiscountFixed: number | null;
  };
}

interface UpcomingBillingSectionProps {
  readonly bookings: UpcomingBooking[];
  readonly periodStart: Date;
  readonly periodEnd: Date;
}

function applyDiscount(
  priceCents: number,
  discPct: number | null,
  discFixed: number | null,
): number {
  let disc = 0;
  if (discPct && discPct > 0) disc = Math.round((priceCents * discPct) / 100);
  if (discFixed && discFixed > disc) disc = discFixed;
  return Math.max(0, priceCents - disc);
}

function fmt(cents: number) {
  return `R\u00a0${(cents / 100).toLocaleString("en-ZA", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

const SESSION_LABELS: Record<string, string> = {
  individual: "Individual",
  couples: "Couples",
  free_consultation: "Free Consult",
};

export function UpcomingBillingSection({
  bookings,
  periodStart,
  periodEnd,
}: UpcomingBillingSectionProps) {
  // Group by student
  const groupMap = new Map<
    string,
    { student: UpcomingBooking["student"]; bookings: UpcomingBooking[] }
  >();
  for (const b of bookings) {
    const key = b.student.id;
    if (!groupMap.has(key)) groupMap.set(key, { student: b.student, bookings: [] });
    const entry = groupMap.get(key);
    if (entry) entry.bookings.push(b);
  }
  const groups = [...groupMap.values()];

  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  const [isPending, startTransition] = useTransition();

  function toggleClient(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handleExclude(bookingId: string) {
    if (!confirm("Exclude this session from billing? It won\u2019t be invoiced but stays on the client\u2019s record.")) return;
    startTransition(async () => {
      try {
        await excludeFromBillingAction(bookingId);
        toast.success("Session excluded from billing");
      } catch {
        toast.error("Failed to exclude session");
      }
    });
  }

  function handleCancel(bookingId: string) {
    if (!confirm("Cancel this session? The client will be notified.")) return;
    startTransition(async () => {
      try {
        await cancelBookingFromBillingAction(bookingId);
        toast.success("Session cancelled");
      } catch {
        toast.error("Failed to cancel session");
      }
    });
  }

  if (bookings.length === 0) {
    return (
      <EmptyState
        icon={Receipt}
        message="No unbilled sessions in the current billing period."
      />
    );
  }

  const grandTotal = groups.reduce((sum, g) => {
    return (
      sum +
      g.bookings.reduce(
        (s, b) =>
          s +
          (b.priceZarCents > 0
            ? applyDiscount(
                b.priceZarCents,
                g.student.standingDiscountPercent,
                g.student.standingDiscountFixed,
              )
            : 0),
        0,
      )
    );
  }, 0);

  const totalSessions = bookings.length;
  const totalClients = groups.length;
  const allExpanded = expanded.size === groups.length;

  return (
    <div className="space-y-4">
      {/* Summary bar */}
      <div className="flex flex-wrap items-center gap-x-6 gap-y-1 rounded-lg border bg-muted/30 px-4 py-3 text-sm">
        <span className="text-muted-foreground">
          Period:{" "}
          <span className="font-medium text-foreground">
            {format(periodStart, "d MMM")} &ndash; {format(periodEnd, "d MMM yyyy")}
          </span>
        </span>
        <span className="text-muted-foreground">
          Billing date:{" "}
          <span className="font-medium text-foreground">
            {format(periodEnd, "d MMM yyyy")}
          </span>
        </span>
        <span className="text-muted-foreground">
          {totalClients} client{totalClients === 1 ? "" : "s"} &middot;{" "}
          {totalSessions} session{totalSessions === 1 ? "" : "s"}
        </span>
        <div className="ml-auto flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs text-muted-foreground"
            onClick={() =>
              allExpanded
                ? setExpanded(new Set())
                : setExpanded(new Set(groups.map((g) => g.student.id)))
            }
          >
            <ChevronsUpDown className="mr-1 h-3 w-3" />
            {allExpanded ? "Collapse all" : "Expand all"}
          </Button>
          <span className="font-mono font-bold">Est. {fmt(grandTotal)}</span>
        </div>
      </div>

      {/* Per-client groups */}
      {groups.map(({ student, bookings: studentBookings }) => {
        const { standingDiscountPercent: discPct, standingDiscountFixed: discFixed } = student;
        const isOpen = expanded.has(student.id);

        const subtotal = studentBookings.reduce(
          (s, b) =>
            s +
            (b.priceZarCents > 0
              ? applyDiscount(b.priceZarCents, discPct, discFixed)
              : 0),
          0,
        );

        let discountLabel: string | null = null;
        if (discPct) discountLabel = `${discPct}% discount`;
        else if (discFixed) discountLabel = `${fmt(discFixed)} discount`;

        return (
          <div key={student.id} className="rounded-md border">
            {/* Group header — click to toggle */}
            <div
              className="flex cursor-pointer select-none items-center justify-between border-b bg-muted/20 px-4 py-2.5"
              onClick={() => toggleClient(student.id)}
            >
              <div className="flex items-center gap-2">
                <ChevronRight
                  className={cn(
                    "h-4 w-4 text-muted-foreground transition-transform",
                    isOpen && "rotate-90",
                  )}
                />
                <Link
                  href={`/admin/clients/${student.id}`}
                  className="text-sm font-medium hover:underline"
                  onClick={(e) => e.stopPropagation()}
                >
                  {student.firstName} {student.lastName}
                </Link>
                <span className="text-xs text-muted-foreground">
                  {studentBookings.length} session{studentBookings.length !== 1 ? "s" : ""}
                </span>
              </div>
              <div className="flex items-center gap-2">
                {discountLabel && (
                  <span className="text-xs text-muted-foreground">{discountLabel}</span>
                )}
                <span className="font-mono text-sm font-semibold">{fmt(subtotal)}</span>
              </div>
            </div>

            {/* Session table — visible when expanded */}
            {isOpen && (
              <>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-xs text-muted-foreground">
                      <th className="px-4 py-1.5 text-left font-medium">Date</th>
                      <th className="px-4 py-1.5 text-left font-medium">Session</th>
                      <th className="px-4 py-1.5 text-left font-medium">Time</th>
                      <th className="px-4 py-1.5 text-right font-medium">Amount</th>
                      <th className="w-10 px-2 py-1.5" />
                    </tr>
                  </thead>
                  <tbody>
                    {studentBookings.map((b) => {
                      const net =
                        b.priceZarCents > 0
                          ? applyDiscount(b.priceZarCents, discPct, discFixed)
                          : 0;
                      const typeLabel = SESSION_LABELS[b.sessionType] ?? b.sessionType;
                      let statusNote = "";
                      if (b.status === "no_show") statusNote = " \u00b7 no-show";
                      else if (b.isLateCancel) statusNote = " \u00b7 late cancel";

                      return (
                        <tr key={b.id} className="border-b last:border-0">
                          <td className="px-4 py-2 text-muted-foreground">
                            {format(new Date(b.date), "d MMM yyyy")}
                          </td>
                          <td className="px-4 py-2">
                            {typeLabel}
                            {statusNote && (
                              <span className="text-muted-foreground">{statusNote}</span>
                            )}
                            {b.billingNote && (
                              <span className="ml-1 text-xs text-muted-foreground">
                                {b.billingNote}
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-2 text-muted-foreground">
                            {b.startTime}&ndash;{b.endTime}
                          </td>
                          <td className="px-4 py-2 text-right font-mono">
                            {b.priceZarCents === 0 ? (
                              <span className="text-xs text-muted-foreground">credit</span>
                            ) : (
                              fmt(net)
                            )}
                          </td>
                          <td className="px-2 py-2">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7"
                                  disabled={isPending}
                                >
                                  <MoreHorizontal className="h-3.5 w-3.5" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem asChild>
                                  <Link href={`/admin/bookings/${b.id}`}>
                                    <Eye className="mr-2 h-3.5 w-3.5" />
                                    View booking
                                  </Link>
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleExclude(b.id)}>
                                  <X className="mr-2 h-3.5 w-3.5" />
                                  Exclude from billing
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  onClick={() => handleCancel(b.id)}
                                  className="text-red-600"
                                >
                                  <Ban className="mr-2 h-3.5 w-3.5" />
                                  Cancel session
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                <div className="border-t px-4 py-2">
                  <Button variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground" asChild>
                    <Link href={`/admin/clients/${student.id}?tab=bookings`}>
                      <Plus className="mr-1 h-3 w-3" />
                      Add session
                    </Link>
                  </Button>
                </div>
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}
