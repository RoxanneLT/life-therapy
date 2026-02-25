"use client";

import { useRouter, useSearchParams } from "next/navigation";
import {
  format,
  parseISO,
  addDays,
  startOfWeek,
  isSameDay,
} from "date-fns";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { getSessionTypeConfig } from "@/lib/booking-config";
import type { BusinessHours } from "@/lib/settings";

interface BookingData {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  clientName: string;
  clientEmail: string;
  sessionType: string;
  status: string;
}

interface OverrideData {
  date: string;
  isBlocked: boolean;
  reason: string | null;
}

interface WeekViewProps {
  bookings: BookingData[];
  date: string;
  businessHours: BusinessHours | null;
  overrides: OverrideData[];
}

const STATUS_DOT: Record<string, string> = {
  pending: "bg-yellow-400",
  confirmed: "bg-green-400",
  cancelled: "bg-red-400",
  completed: "bg-blue-400",
  no_show: "bg-gray-400",
};

const SESSION_COLORS: Record<string, string> = {
  individual: "border-l-green-500 bg-green-50 hover:bg-green-100",
  couples: "border-l-purple-500 bg-purple-50 hover:bg-purple-100",
  free_consultation: "border-l-blue-500 bg-blue-50 hover:bg-blue-100",
};

const DAY_KEYS = ["monday", "tuesday", "wednesday", "thursday", "friday"];

function timeToMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

export function WeekView({ bookings, date, businessHours, overrides }: WeekViewProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const monday = startOfWeek(parseISO(date), { weekStartsOn: 1 });
  const weekDays = Array.from({ length: 5 }, (_, i) => addDays(monday, i));

  // Determine earliest/latest business hours across Mon-Fri
  let earliestMinutes = 9 * 60;
  let latestMinutes = 17 * 60;

  if (businessHours) {
    for (const key of DAY_KEYS) {
      const dh = businessHours[key];
      if (dh && !dh.closed) {
        const open = timeToMinutes(dh.open);
        const close = timeToMinutes(dh.close);
        if (open < earliestMinutes) earliestMinutes = open;
        if (close > latestMinutes) latestMinutes = close;
      }
    }
  }

  // Generate time slots
  const slots: string[] = [];
  for (let m = earliestMinutes; m < latestMinutes; m += 30) {
    const hh = String(Math.floor(m / 60)).padStart(2, "0");
    const mm = String(m % 60).padStart(2, "0");
    slots.push(`${hh}:${mm}`);
  }

  function navigateWeek(newMonday: Date) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("date", format(newMonday, "yyyy-MM-dd"));
    params.set("view", "week");
    router.push(`/admin/bookings?${params.toString()}`);
  }

  // Build lookup: dateStr -> bookings
  const bookingsByDate: Record<string, BookingData[]> = {};
  for (const b of bookings) {
    const key = typeof b.date === "string" ? b.date.slice(0, 10) : format(new Date(b.date), "yyyy-MM-dd");
    if (!bookingsByDate[key]) bookingsByDate[key] = [];
    bookingsByDate[key].push(b);
  }

  // Build override lookup: dateStr -> override
  const overrideByDate: Record<string, OverrideData> = {};
  for (const ov of overrides) {
    const key = typeof ov.date === "string" ? ov.date.slice(0, 10) : format(new Date(ov.date), "yyyy-MM-dd");
    overrideByDate[key] = ov;
  }

  const prevMonday = addDays(monday, -7);
  const nextMonday = addDays(monday, 7);

  return (
    <div>
      {/* Week navigation */}
      <div className="mb-4 flex items-center justify-between">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigateWeek(prevMonday)}
        >
          <ChevronLeft className="mr-1 h-4 w-4" />
          Week of {format(prevMonday, "d MMM")}
        </Button>
        <h2 className="font-heading text-lg font-semibold">
          Week of {format(monday, "d MMMM yyyy")}
        </h2>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigateWeek(nextMonday)}
        >
          Week of {format(nextMonday, "d MMM")}
          <ChevronRight className="ml-1 h-4 w-4" />
        </Button>
      </div>

      {/* Grid */}
      <div className="overflow-x-auto rounded-lg border">
        <div
          className="grid min-w-[800px]"
          style={{ gridTemplateColumns: "64px repeat(5, 1fr)" }}
        >
          {/* Header row */}
          <div className="border-b border-r bg-muted/50 px-2 py-2" />
          {weekDays.map((day) => {
            const dateStr = format(day, "yyyy-MM-dd");
            const blocked = overrideByDate[dateStr]?.isBlocked;
            const isToday = isSameDay(day, new Date());

            return (
              <div
                key={dateStr}
                className={`border-b border-r px-3 py-2 text-center text-sm font-medium last:border-r-0 ${
                  blocked ? "bg-gray-100 text-gray-400" : isToday ? "bg-brand-50 text-brand-700" : "bg-muted/50"
                }`}
              >
                <div>{format(day, "EEE")}</div>
                <div className="text-xs">{format(day, "d MMM")}</div>
                {blocked && (
                  <div className="mt-0.5 text-xs text-amber-600">Blocked</div>
                )}
              </div>
            );
          })}

          {/* Time slots */}
          {slots.map((slot) => {
            const slotMinutes = timeToMinutes(slot);

            return (
              <div key={slot} className="contents">
                {/* Time label */}
                <div className="flex items-start justify-end border-b border-r px-2 py-1">
                  <span className="text-xs text-muted-foreground">{slot}</span>
                </div>

                {/* Day columns */}
                {weekDays.map((day) => {
                  const dateStr = format(day, "yyyy-MM-dd");
                  const dayBookings = bookingsByDate[dateStr] || [];
                  const slotBookings = dayBookings.filter(
                    (b) => timeToMinutes(b.startTime) === slotMinutes
                  );
                  const blocked = overrideByDate[dateStr]?.isBlocked;

                  return (
                    <div
                      key={dateStr}
                      className={`min-h-[2.5rem] border-b border-r px-1 py-0.5 last:border-r-0 ${
                        blocked ? "bg-gray-50" : ""
                      }`}
                    >
                      {slotBookings.map((booking) => {
                        const colorClass =
                          SESSION_COLORS[booking.sessionType] ||
                          "border-l-gray-400 bg-gray-50 hover:bg-gray-100";

                        return (
                          <Link
                            key={booking.id}
                            href={`/admin/bookings/${booking.id}`}
                            className={`mb-0.5 block rounded border-l-3 px-2 py-1 text-xs transition-colors ${colorClass}`}
                          >
                            <div className="flex items-center gap-1">
                              <span
                                className={`inline-block h-1.5 w-1.5 rounded-full ${STATUS_DOT[booking.status] || "bg-gray-400"}`}
                              />
                              <span className="font-medium">
                                {booking.startTime}
                              </span>
                            </div>
                            <div className="truncate">
                              {booking.clientName}
                            </div>
                          </Link>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
