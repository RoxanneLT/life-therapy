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

const STATUS_STYLES: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800",
  confirmed: "bg-green-100 text-green-800",
  cancelled: "bg-red-100 text-red-800",
  completed: "bg-blue-100 text-blue-800",
  no_show: "bg-gray-100 text-gray-800",
};

const SESSION_COLORS: Record<string, string> = {
  individual: "border-l-green-500 bg-green-50",
  couples: "border-l-purple-500 bg-purple-50",
  free_consultation: "border-l-blue-500 bg-blue-50",
};

function timeToMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

function getDayKey(date: Date): string {
  const days = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
  return days[date.getDay()];
}

export function DayView({ bookings, date, businessHours, override }: DayViewProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const currentDate = parseISO(date);
  const dayKey = getDayKey(currentDate);
  const dayHours = businessHours?.[dayKey];

  // Determine time range
  const startHour = dayHours && !dayHours.closed ? timeToMinutes(dayHours.open) : 8 * 60;
  const endHour = dayHours && !dayHours.closed ? timeToMinutes(dayHours.close) : 18 * 60;

  // Generate 30-min time slots
  const slots: string[] = [];
  for (let m = startHour; m < endHour; m += 30) {
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

  return (
    <div className="flex gap-6">
      {/* Left column — Timeline */}
      <div className="min-w-0 flex-1">
        {/* Date navigation */}
        <div className="mb-4 flex items-center justify-between">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigateDate(subDays(currentDate, 1))}
          >
            <ChevronLeft className="mr-1 h-4 w-4" />
            {format(subDays(currentDate, 1), "d MMM")}
          </Button>
          <h2 className="font-heading text-lg font-semibold">
            {format(currentDate, "EEEE d MMMM yyyy")}
          </h2>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigateDate(addDays(currentDate, 1))}
          >
            {format(addDays(currentDate, 1), "d MMM")}
            <ChevronRight className="ml-1 h-4 w-4" />
          </Button>
        </div>

        {/* Blocked day banner */}
        {override?.isBlocked && (
          <div className="mb-4 flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span>
              This day is blocked{override.reason ? `: ${override.reason}` : ""}
            </span>
          </div>
        )}

        {bookings.length === 0 ? (
          <div className="flex flex-col items-center rounded-lg border border-dashed py-16 text-center">
            <p className="text-muted-foreground">No bookings on this day.</p>
          </div>
        ) : (
          <div className="relative rounded-lg border">
            {/* Time grid */}
            {slots.map((slot, i) => {
              const slotMinutes = timeToMinutes(slot);
              const isBusinessHour =
                dayHours && !dayHours.closed &&
                slotMinutes >= timeToMinutes(dayHours.open) &&
                slotMinutes < timeToMinutes(dayHours.close);

              // Find bookings that start at this slot
              const slotBookings = bookings.filter(
                (b) => timeToMinutes(b.startTime) === slotMinutes
              );

              return (
                <div
                  key={slot}
                  className={`flex min-h-[3rem] border-b last:border-b-0 ${
                    isBusinessHour ? "bg-white" : "bg-gray-50"
                  }`}
                >
                  {/* Time label */}
                  <div className="flex w-16 shrink-0 items-start justify-end border-r px-2 py-1">
                    <span className="text-xs text-muted-foreground">{slot}</span>
                  </div>

                  {/* Booking blocks */}
                  <div className="flex-1 px-2 py-1">
                    {slotBookings.map((booking) => {
                      const config = getSessionTypeConfig(booking.sessionType as never);
                      const colorClass =
                        SESSION_COLORS[booking.sessionType] || "border-l-gray-400 bg-gray-50";

                      return (
                        <button
                          key={booking.id}
                          type="button"
                          onClick={() => setSelectedId(booking.id === selectedId ? null : booking.id)}
                          className={`mb-1 w-full cursor-pointer rounded-md border-l-4 px-3 py-2 text-left transition-shadow hover:shadow-md ${colorClass} ${
                            booking.id === selectedId ? "ring-2 ring-brand-500" : ""
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium">
                              {booking.startTime} – {booking.endTime}
                            </span>
                            <Badge
                              variant="secondary"
                              className={`text-xs ${STATUS_STYLES[booking.status] || ""}`}
                            >
                              {booking.status.replace("_", " ")}
                            </Badge>
                          </div>
                          <div className="mt-0.5 text-sm">
                            {booking.clientName}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {config.label}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Right column — Detail Panel */}
      {selected && (
        <div className="w-[380px] shrink-0">
          <Card>
            <CardContent className="p-5">
              <div className="mb-4 flex items-start justify-between">
                <h3 className="font-heading text-lg font-semibold">
                  Booking Details
                </h3>
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
                <DetailRow label="Date">
                  {format(parseISO(date), "d MMMM yyyy")}
                </DetailRow>
                <DetailRow label="Time">
                  {selected.startTime} – {selected.endTime}
                </DetailRow>
                <DetailRow label="Client">
                  {selected.clientName}
                </DetailRow>
                <DetailRow label="Email">
                  {selected.clientEmail}
                </DetailRow>
                {selected.clientPhone && (
                  <DetailRow label="Phone">
                    {selected.clientPhone}
                  </DetailRow>
                )}
                <DetailRow label="Status">
                  <Badge
                    variant="secondary"
                    className={STATUS_STYLES[selected.status] || ""}
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
                      Join meeting
                      <ExternalLink className="h-3 w-3" />
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

function DetailRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex gap-3">
      <span className="w-16 shrink-0 text-muted-foreground">{label}</span>
      <span className="min-w-0 break-words">{children}</span>
    </div>
  );
}
