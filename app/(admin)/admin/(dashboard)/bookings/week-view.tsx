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
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { BusinessHours } from "@/lib/settings";
import { BOOKING_STATUS_DOT } from "@/lib/status-styles";

interface BookingData {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  clientName: string;
  clientEmail: string;
  couplesPartnerName: string | null;
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

const SESSION_COLORS: Record<string, string> = {
  individual:        "border-l-green-500  bg-green-50  hover:bg-green-100  dark:bg-green-900/50  dark:hover:bg-green-900/70  dark:text-green-100  dark:border-l-green-400",
  couples:           "border-l-purple-500 bg-purple-50 hover:bg-purple-100 dark:bg-purple-900/50 dark:hover:bg-purple-900/70 dark:text-purple-100 dark:border-l-purple-400",
  free_consultation: "border-l-blue-500   bg-blue-50   hover:bg-blue-100   dark:bg-blue-900/50   dark:hover:bg-blue-900/70   dark:text-blue-100   dark:border-l-blue-400",
};

const DAY_KEYS = ["monday", "tuesday", "wednesday", "thursday", "friday"];

/** px height per 15-minute slot */
const ROW_H = 20;

function timeToMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

export function WeekView({ bookings, date, businessHours, overrides }: Readonly<WeekViewProps>) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const monday = startOfWeek(parseISO(date), { weekStartsOn: 1 });
  const weekDays = Array.from({ length: 5 }, (_, i) => addDays(monday, i));

  // Determine earliest/latest business hours across Mon-Fri
  let gridStart = 9 * 60;
  let gridEnd   = 17 * 60;

  if (businessHours) {
    for (const key of DAY_KEYS) {
      const dh = businessHours[key];
      if (dh && !dh.closed) {
        const open  = timeToMinutes(dh.open);
        const close = timeToMinutes(dh.close);
        if (open  < gridStart) gridStart = open;
        if (close > gridEnd)   gridEnd   = close;
      }
    }
  }

  // Generate 15-min time slots
  const slots: string[] = [];
  for (let m = gridStart; m < gridEnd; m += 15) {
    const hh = String(Math.floor(m / 60)).padStart(2, "0");
    const mm = String(m % 60).padStart(2, "0");
    slots.push(`${hh}:${mm}`);
  }

  const totalHeight = slots.length * ROW_H;

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

  // Build override lookup
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
        <Button variant="ghost" size="sm" onClick={() => navigateWeek(prevMonday)}>
          <ChevronLeft className="mr-1 h-4 w-4" />
          Week of {format(prevMonday, "d MMM")}
        </Button>
        <h2 className="font-heading text-lg font-semibold">
          Week of {format(monday, "d MMMM yyyy")}
        </h2>
        <Button variant="ghost" size="sm" onClick={() => navigateWeek(nextMonday)}>
          Week of {format(nextMonday, "d MMM")}
          <ChevronRight className="ml-1 h-4 w-4" />
        </Button>
      </div>

      {/* Grid */}
      <div className="overflow-x-auto rounded-lg border bg-white dark:bg-zinc-900">
        <div className="min-w-[700px]">

          {/* Header row */}
          <div className="flex border-b">
            <div className="w-14 shrink-0 border-r bg-muted/50" />
            {weekDays.map((day) => {
              const dateStr = format(day, "yyyy-MM-dd");
              const blocked = overrideByDate[dateStr]?.isBlocked;
              const isToday = isSameDay(day, new Date());
              let headerBg = "bg-muted/50";
              if (blocked) headerBg = "bg-gray-100 text-gray-400";
              else if (isToday) headerBg = "bg-brand-50 text-brand-700";

              return (
                <div
                  key={dateStr}
                  className={`flex-1 border-r px-3 py-2 text-center text-sm font-medium last:border-r-0 ${headerBg}`}
                >
                  <div>{format(day, "EEE")}</div>
                  <div className="text-xs">{format(day, "d MMM")}</div>
                  {blocked && <div className="mt-0.5 text-xs text-amber-600">Blocked</div>}
                </div>
              );
            })}
          </div>

          {/* Body: time column + day columns */}
          <div className="flex" style={{ height: totalHeight }}>

            {/* Time label column */}
            <div className="relative w-14 shrink-0 border-r">
              {slots.map((slot, i) => (
                <div
                  key={slot}
                  className="absolute flex w-full items-start justify-end px-1"
                  style={{ top: i * ROW_H, height: ROW_H }}
                >
                  {slot.endsWith(":00") && (
                    <span className="text-xs text-muted-foreground">{slot}</span>
                  )}
                </div>
              ))}
            </div>

            {/* Day columns */}
            {weekDays.map((day) => {
              const dateStr  = format(day, "yyyy-MM-dd");
              const dayBookings = bookingsByDate[dateStr] || [];
              const blocked  = overrideByDate[dateStr]?.isBlocked;

              return (
                <div
                  key={dateStr}
                  className={`relative flex-1 border-r last:border-r-0 ${blocked ? "bg-gray-50" : ""}`}
                  style={{ height: totalHeight }}
                >
                  {/* Horizontal grid lines */}
                  {slots.map((slot, i) => {
                    let lineClass = "";
                    if (i > 0) lineClass = slot.endsWith(":00") ? "border-t border-t-gray-300 dark:border-t-zinc-600" : "border-t border-t-gray-100 dark:border-t-zinc-700/50";
                    return (
                      <div key={slot} className={`absolute w-full ${lineClass}`} style={{ top: i * ROW_H, height: ROW_H }} />
                    );
                  })}

                  {/* Booking blocks */}
                  {dayBookings.map((booking) => {
                    const colorClass =
                      SESSION_COLORS[booking.sessionType] ||
                      "border-l-gray-400 bg-gray-50 hover:bg-gray-100";
                    const startMins = timeToMinutes(booking.startTime);
                    const endMins   = timeToMinutes(booking.endTime);
                    const duration  = endMins - startMins;
                    const top    = ((startMins - gridStart) / 15) * ROW_H + 1;
                    const height = Math.max((duration / 15) * ROW_H - 2, ROW_H);

                    return (
                      <Link
                        key={booking.id}
                        href={`/admin/bookings/${booking.id}`}
                        className={`absolute overflow-hidden rounded border-l-2 px-1.5 py-0.5 text-xs transition-colors ${colorClass}`}
                        style={{ top, height, left: 2, right: 2 }}
                      >
                        <div className="flex items-center gap-1">
                          <span
                            className={`inline-block h-1.5 w-1.5 shrink-0 rounded-full ${BOOKING_STATUS_DOT[booking.status] || "bg-gray-400"}`}
                          />
                          <span className="font-medium">{booking.startTime} – {booking.endTime}</span>
                        </div>
                        <div className="truncate">
                          {booking.clientName}
                          {booking.couplesPartnerName && (
                            <span className="text-muted-foreground"> & {booking.couplesPartnerName}</span>
                          )}
                        </div>
                      </Link>
                    );
                  })}
                </div>
              );
            })}
          </div>

        </div>
      </div>
    </div>
  );
}
