"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { format, parseISO, addDays, subDays } from "date-fns";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ChevronLeft, ChevronRight, X, ExternalLink, AlertTriangle, CalendarClock } from "lucide-react";
import { getSessionTypeConfig } from "@/lib/booking-config";
import type { BusinessHours } from "@/lib/settings";
import { BOOKING_STATUS_BADGE } from "@/lib/status-styles";

interface BookingData {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  clientName: string;
  clientEmail: string;
  clientPhone: string | null;
  sessionType: string;
  status: string;
  teamsMeetingUrl: string | null;
  adminNotes: string | null;
}

interface OverrideData {
  isBlocked: boolean;
  reason: string | null;
}

interface DayViewProps {
  bookings: BookingData[];
  date: string;
  businessHours: BusinessHours | null;
  override: OverrideData | null;
}

const SESSION_COLORS: Record<string, string> = {
  individual:        "border-l-green-500  bg-green-50  hover:bg-green-100  dark:bg-green-900/50  dark:hover:bg-green-900/70  dark:text-green-100  dark:border-l-green-400",
  couples:           "border-l-purple-500 bg-purple-50 hover:bg-purple-100 dark:bg-purple-900/50 dark:hover:bg-purple-900/70 dark:text-purple-100 dark:border-l-purple-400",
  free_consultation: "border-l-blue-500   bg-blue-50   hover:bg-blue-100   dark:bg-blue-900/50   dark:hover:bg-blue-900/70   dark:text-blue-100   dark:border-l-blue-400",
};

/** px height per 15-minute slot */
const ROW_H = 24;

function timeToMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

function getDayKey(date: Date): string {
  const days = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
  return days[date.getDay()];
}

export function DayView({ bookings, date, businessHours, override }: Readonly<DayViewProps>) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const currentDate = parseISO(date);
  const dayKey = getDayKey(currentDate);
  const dayHours = businessHours?.[dayKey];

  // Determine time range
  const gridStart = dayHours && !dayHours.closed ? timeToMinutes(dayHours.open) : 8 * 60;
  const gridEnd   = dayHours && !dayHours.closed ? timeToMinutes(dayHours.close) : 18 * 60;

  // Generate 15-min time slots
  const slots: string[] = [];
  for (let m = gridStart; m < gridEnd; m += 15) {
    const hh = String(Math.floor(m / 60)).padStart(2, "0");
    const mm = String(m % 60).padStart(2, "0");
    slots.push(`${hh}:${mm}`);
  }

  const selected = bookings.find((b) => b.id === selectedId) || null;

  function navigateDate(newDate: Date) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("date", format(newDate, "yyyy-MM-dd"));
    params.set("view", "day");
    router.push(`/admin/bookings?${params.toString()}`);
  }

  const totalHeight = slots.length * ROW_H;

  return (
    <div className="flex gap-6">
      {/* Left column — Timeline */}
      <div className="min-w-0 flex-1">
        {/* Date navigation */}
        <div className="mb-4 flex items-center justify-between">
          <Button variant="ghost" size="sm" onClick={() => navigateDate(subDays(currentDate, 1))}>
            <ChevronLeft className="mr-1 h-4 w-4" />
            {format(subDays(currentDate, 1), "d MMM")}
          </Button>
          <h2 className="font-heading text-lg font-semibold">
            {format(currentDate, "EEEE d MMMM yyyy")}
          </h2>
          <Button variant="ghost" size="sm" onClick={() => navigateDate(addDays(currentDate, 1))}>
            {format(addDays(currentDate, 1), "d MMM")}
            <ChevronRight className="ml-1 h-4 w-4" />
          </Button>
        </div>

        {/* Blocked day banner */}
        {override?.isBlocked && (
          <div className="mb-4 flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span>This day is blocked{override.reason ? `: ${override.reason}` : ""}</span>
          </div>
        )}

        <div className="relative rounded-lg border bg-white dark:bg-zinc-900">
          {/* Time grid rows — fixed height, no booking content */}
          {slots.map((slot, i) => {
            const slotMinutes = timeToMinutes(slot);
            const isBusinessHour =
              dayHours && !dayHours.closed &&
              slotMinutes >= timeToMinutes(dayHours.open) &&
              slotMinutes < timeToMinutes(dayHours.close);
            const isHour = slot.endsWith(":00");
            let lineClass = "";
            if (i > 0) lineClass = isHour ? "border-t border-t-gray-300 dark:border-t-zinc-600" : "border-t border-t-gray-100 dark:border-t-zinc-700/50";

            return (
              <div
                key={slot}
                style={{ height: ROW_H }}
                className={`flex ${lineClass} ${isBusinessHour ? "bg-white dark:bg-zinc-900" : "bg-gray-50 dark:bg-zinc-800"}`}
              >
                <div className="flex w-16 shrink-0 items-start justify-end border-r px-2 py-1">
                  {isHour && (
                    <span className="text-xs text-muted-foreground">{slot}</span>
                  )}
                </div>
              </div>
            );
          })}

          {/* Absolutely positioned booking blocks */}
          <div className="pointer-events-none absolute inset-0 left-16" style={{ height: totalHeight }}>
            {bookings.map((booking) => {
              const config = getSessionTypeConfig(booking.sessionType as never);
              const colorClass = SESSION_COLORS[booking.sessionType] || "border-l-gray-400 bg-gray-50";
              const startMins = timeToMinutes(booking.startTime);
              const endMins   = timeToMinutes(booking.endTime);
              const duration  = endMins - startMins;
              const top    = ((startMins - gridStart) / 15) * ROW_H + 1;
              const height = Math.max((duration / 15) * ROW_H - 2, ROW_H);

              return (
                <button
                  key={booking.id}
                  type="button"
                  onClick={() => setSelectedId(booking.id === selectedId ? null : booking.id)}
                  className={`pointer-events-auto absolute cursor-pointer overflow-hidden rounded-md border-l-4 px-3 py-1.5 text-left transition-shadow hover:shadow-md ${colorClass} ${
                    booking.id === selectedId ? "ring-2 ring-brand-500" : ""
                  }`}
                  style={{ top, height, left: 8, right: 8 }}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium">
                      {booking.startTime} – {booking.endTime}
                    </span>
                    <Badge
                      variant="secondary"
                      className={`shrink-0 text-xs ${BOOKING_STATUS_BADGE[booking.status] || ""}`}
                    >
                      {booking.status.replace("_", " ")}
                    </Badge>
                  </div>
                  <div className="mt-0.5 truncate text-sm">{booking.clientName}</div>
                  {height >= ROW_H && (
                    <div className="truncate text-xs text-muted-foreground">{config.label}</div>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Right column — Detail Panel */}
      {selected && (
        <div className="w-[380px] shrink-0">
          <Card>
            <CardContent className="p-5">
              <div className="mb-4 flex items-start justify-between">
                <h3 className="font-heading text-lg font-semibold">Booking Details</h3>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedId(null)}
                  className="h-8 w-8 p-0"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>

              <div className="space-y-3 text-sm">
                <DetailRow label="Session">
                  {getSessionTypeConfig(selected.sessionType as never).label}
                </DetailRow>
                <DetailRow label="Date">{format(parseISO(date), "d MMMM yyyy")}</DetailRow>
                <DetailRow label="Time">{selected.startTime} – {selected.endTime}</DetailRow>
                <DetailRow label="Client">{selected.clientName}</DetailRow>
                <DetailRow label="Email">{selected.clientEmail}</DetailRow>
                {selected.clientPhone && (
                  <DetailRow label="Phone">{selected.clientPhone}</DetailRow>
                )}
                <DetailRow label="Status">
                  <Badge
                    variant="secondary"
                    className={BOOKING_STATUS_BADGE[selected.status] || ""}
                  >
                    {selected.status.replace("_", " ")}
                  </Badge>
                </DetailRow>
                {selected.teamsMeetingUrl && (
                  <DetailRow label="Teams">
                    <a
                      href={selected.teamsMeetingUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-brand-600 hover:underline"
                    >
                      Join meeting <ExternalLink className="h-3 w-3" />
                    </a>
                  </DetailRow>
                )}
                {selected.adminNotes && (
                  <DetailRow label="Notes">
                    <span className="text-muted-foreground">{selected.adminNotes}</span>
                  </DetailRow>
                )}
              </div>

              <div className="mt-5 space-y-2">
                <Link href={`/admin/bookings/${selected.id}`}>
                  <Button variant="outline" size="sm" className="w-full">
                    View Full Details
                  </Button>
                </Link>
                {selected.status !== "cancelled" && selected.status !== "completed" && (
                  <Link href={`/admin/bookings/${selected.id}`}>
                    <Button variant="ghost" size="sm" className="w-full">
                      <CalendarClock className="mr-2 h-4 w-4" />
                      Reschedule
                    </Button>
                  </Link>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

function DetailRow({ label, children }: Readonly<{ label: string; children: React.ReactNode }>) {
  return (
    <div className="flex gap-3">
      <span className="w-16 shrink-0 text-muted-foreground">{label}</span>
      <span className="min-w-0 break-words">{children}</span>
    </div>
  );
}
