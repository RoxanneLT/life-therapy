"use client";

import { useRouter, useSearchParams } from "next/navigation";
import {
  format,
  parseISO,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  addMonths,
  subMonths,
} from "date-fns";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface BookingData {
  id: string;
  date: string;
  startTime: string;
  clientName: string;
  sessionType: string;
  status: string;
}

interface MonthViewProps {
  bookings: BookingData[];
  date: string;
}

const SESSION_DOT: Record<string, string> = {
  individual: "bg-green-500",
  couples: "bg-purple-500",
  free_consultation: "bg-blue-500",
};

const STATUS_LINE: Record<string, string> = {
  pending: "bg-yellow-200",
  confirmed: "bg-green-200",
  cancelled: "bg-red-200 line-through",
  completed: "bg-blue-200",
  no_show: "bg-gray-200",
};

export function MonthView({ bookings, date }: MonthViewProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const current = parseISO(date);
  const monthStart = startOfMonth(current);
  const monthEnd = endOfMonth(current);

  // Grid: start from Monday of the week containing the 1st, end at Sunday of the last week
  const gridStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
  const allDays = eachDayOfInterval({ start: gridStart, end: gridEnd });

  // Build lookup: dateStr -> bookings
  const bookingsByDate: Record<string, BookingData[]> = {};
  for (const b of bookings) {
    const key = typeof b.date === "string" ? b.date.slice(0, 10) : format(new Date(b.date), "yyyy-MM-dd");
    if (!bookingsByDate[key]) bookingsByDate[key] = [];
    bookingsByDate[key].push(b);
  }

  // Sort each day's bookings by startTime
  for (const key of Object.keys(bookingsByDate)) {
    bookingsByDate[key].sort((a, b) => a.startTime.localeCompare(b.startTime));
  }

  function navigateMonth(newDate: Date) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("date", format(newDate, "yyyy-MM-dd"));
    params.set("view", "month");
    router.push(`/admin/bookings?${params.toString()}`);
  }

  function switchToDay(day: Date) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("date", format(day, "yyyy-MM-dd"));
    params.set("view", "day");
    router.push(`/admin/bookings?${params.toString()}`);
  }

  const today = new Date();
  const prevMonth = subMonths(monthStart, 1);
  const nextMonth = addMonths(monthStart, 1);

  // Split days into weeks (rows)
  const weeks: Date[][] = [];
  for (let i = 0; i < allDays.length; i += 7) {
    weeks.push(allDays.slice(i, i + 7));
  }

  return (
    <div>
      {/* Month navigation */}
      <div className="mb-4 flex items-center justify-between">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigateMonth(prevMonth)}
        >
          <ChevronLeft className="mr-1 h-4 w-4" />
          {format(prevMonth, "MMMM yyyy")}
        </Button>
        <h2 className="font-heading text-lg font-semibold">
          {format(monthStart, "MMMM yyyy")}
        </h2>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigateMonth(nextMonth)}
        >
          {format(nextMonth, "MMMM yyyy")}
          <ChevronRight className="ml-1 h-4 w-4" />
        </Button>
      </div>

      {/* Calendar grid */}
      <div className="overflow-hidden rounded-lg border">
        {/* Day-of-week headers */}
        <div className="grid grid-cols-7 border-b bg-muted/50">
          {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
            <div
              key={d}
              className={cn(
                "px-2 py-2 text-center text-xs font-medium text-muted-foreground",
                d === "Sat" || d === "Sun" ? "bg-gray-50" : "",
              )}
            >
              {d}
            </div>
          ))}
        </div>

        {/* Week rows */}
        {weeks.map((week, wi) => (
          <div key={wi} className="grid grid-cols-7 border-b last:border-b-0">
            {week.map((day) => {
              const dateStr = format(day, "yyyy-MM-dd");
              const dayBookings = bookingsByDate[dateStr] || [];
              const isCurrentMonth = isSameMonth(day, monthStart);
              const isToday = isSameDay(day, today);
              const isWeekend = day.getDay() === 0 || day.getDay() === 6;
              const MAX_PILLS = 3;
              const overflow = dayBookings.length - MAX_PILLS;

              return (
                <div
                  key={dateStr}
                  className={cn(
                    "min-h-[6rem] border-r p-1.5 last:border-r-0",
                    !isCurrentMonth && "bg-gray-50/60",
                    isWeekend && isCurrentMonth && "bg-gray-50/30",
                    isToday && "bg-brand-50/40",
                  )}
                >
                  {/* Day number */}
                  <button
                    type="button"
                    onClick={() => switchToDay(day)}
                    className={cn(
                      "mb-1 inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium transition-colors hover:bg-brand-100",
                      isToday && "bg-brand-600 text-white hover:bg-brand-700",
                      !isCurrentMonth && "text-gray-300",
                    )}
                  >
                    {format(day, "d")}
                  </button>

                  {/* Booking pills */}
                  <div className="space-y-0.5">
                    {dayBookings.slice(0, MAX_PILLS).map((booking) => {
                      const shortName =
                        booking.clientName.split(" ")[0] +
                        (booking.clientName.split(" ")[1]
                          ? ` ${booking.clientName.split(" ")[1][0]}.`
                          : "");

                      return (
                        <Link
                          key={booking.id}
                          href={`/admin/bookings/${booking.id}`}
                          className={cn(
                            "block truncate rounded px-1 py-0.5 text-[10px] leading-tight transition-opacity hover:opacity-80",
                            STATUS_LINE[booking.status] || "bg-gray-100",
                            booking.status === "cancelled" &&
                              "text-red-500 line-through",
                          )}
                        >
                          <span className="flex items-center gap-1">
                            <span
                              className={cn(
                                "inline-block h-1.5 w-1.5 shrink-0 rounded-full",
                                SESSION_DOT[booking.sessionType] || "bg-gray-400",
                              )}
                            />
                            <span className="truncate">
                              {booking.startTime} {shortName}
                            </span>
                          </span>
                        </Link>
                      );
                    })}
                    {overflow > 0 && (
                      <button
                        type="button"
                        onClick={() => switchToDay(day)}
                        className="w-full text-center text-[10px] text-muted-foreground hover:text-foreground"
                      >
                        +{overflow} more
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
