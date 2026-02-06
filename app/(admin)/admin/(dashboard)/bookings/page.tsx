export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { getSessionTypeConfig } from "@/lib/booking-config";
import { format } from "date-fns";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { CalendarDays, Settings, ShieldOff } from "lucide-react";
import type { BookingStatus } from "@/lib/generated/prisma/client";

const STATUS_STYLES: Record<BookingStatus, string> = {
  pending: "bg-yellow-100 text-yellow-800",
  confirmed: "bg-green-100 text-green-800",
  cancelled: "bg-red-100 text-red-800",
  completed: "bg-blue-100 text-blue-800",
  no_show: "bg-gray-100 text-gray-800",
};

interface Props {
  readonly searchParams: { status?: string };
}

export default async function BookingsPage({ searchParams }: Props) {
  await requireRole("super_admin", "editor");

  const statusFilter = searchParams.status;
  const where = statusFilter
    ? { status: statusFilter as BookingStatus }
    : {};

  const bookings = await prisma.booking.findMany({
    where,
    orderBy: [{ date: "desc" }, { startTime: "desc" }],
  });

  const counts = await prisma.booking.groupBy({
    by: ["status"],
    _count: true,
  });

  const countMap = Object.fromEntries(
    counts.map((c) => [c.status, c._count])
  );
  const total = counts.reduce((sum, c) => sum + c._count, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold">Bookings</h1>
          <p className="text-sm text-muted-foreground">
            Manage session bookings and client appointments.
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/admin/bookings/availability">
            <Button variant="outline" size="sm">
              <ShieldOff className="mr-2 h-4 w-4" />
              Availability
            </Button>
          </Link>
          <Link href="/admin/bookings/settings">
            <Button variant="outline" size="sm">
              <Settings className="mr-2 h-4 w-4" />
              Settings
            </Button>
          </Link>
        </div>
      </div>

      {/* Status filter tabs */}
      <div className="flex gap-2 flex-wrap">
        <Link href="/admin/bookings">
          <Badge
            variant={!statusFilter ? "default" : "outline"}
            className="cursor-pointer"
          >
            All ({total})
          </Badge>
        </Link>
        {(
          ["confirmed", "pending", "completed", "cancelled", "no_show"] as const
        ).map((status) => (
          <Link key={status} href={`/admin/bookings?status=${status}`}>
            <Badge
              variant={statusFilter === status ? "default" : "outline"}
              className="cursor-pointer"
            >
              {status.replace("_", " ")}{" "}
              ({countMap[status] || 0})
            </Badge>
          </Link>
        ))}
      </div>

      {/* Bookings table */}
      {bookings.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-12 text-center">
          <CalendarDays className="h-12 w-12 text-muted-foreground/50" />
          <h3 className="mt-4 font-heading text-lg font-semibold">
            No bookings{statusFilter ? ` with status "${statusFilter}"` : ""}
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Bookings will appear here when clients schedule sessions.
          </p>
        </div>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Time</TableHead>
                <TableHead>Client</TableHead>
                <TableHead>Session</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {bookings.map((booking) => {
                const config = getSessionTypeConfig(booking.sessionType);
                return (
                  <TableRow key={booking.id}>
                    <TableCell className="font-medium">
                      {format(new Date(booking.date), "d MMM yyyy")}
                    </TableCell>
                    <TableCell>
                      {booking.startTime} – {booking.endTime}
                    </TableCell>
                    <TableCell>
                      <div>{booking.clientName}</div>
                      <div className="text-xs text-muted-foreground">
                        {booking.clientEmail}
                      </div>
                    </TableCell>
                    <TableCell>{config.label}</TableCell>
                    <TableCell>
                      <Badge
                        variant="secondary"
                        className={STATUS_STYLES[booking.status]}
                      >
                        {booking.status.replace("_", " ")}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Link href={`/admin/bookings/${booking.id}`}>
                        <Button variant="ghost" size="sm">
                          View
                        </Button>
                      </Link>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
