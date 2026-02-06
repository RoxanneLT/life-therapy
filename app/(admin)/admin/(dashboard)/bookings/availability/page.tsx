export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { format } from "date-fns";
import { AvailabilityOverrideForm } from "@/components/admin/availability-override-form";
import { deleteAvailabilityOverride } from "./actions";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Trash2, ArrowLeft } from "lucide-react";
import Link from "next/link";

export default async function AvailabilityOverridesPage() {
  await requireRole("super_admin");

  const overrides = await prisma.availabilityOverride.findMany({
    orderBy: { date: "asc" },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/admin/bookings">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
        </Link>
        <div>
          <h1 className="font-heading text-2xl font-bold">
            Availability Overrides
          </h1>
          <p className="text-sm text-muted-foreground">
            Block off dates or set custom hours for specific days. These
            override your regular business hours.
          </p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Add Override Form */}
        <AvailabilityOverrideForm />

        {/* Existing Overrides */}
        <div>
          <h2 className="mb-4 font-heading text-lg font-semibold">
            Current Overrides
          </h2>
          {overrides.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No overrides set. Your regular business hours apply to all days.
            </p>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Details</TableHead>
                    <TableHead className="w-[50px]" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {overrides.map((override) => (
                    <TableRow key={override.id}>
                      <TableCell className="font-medium">
                        {format(new Date(override.date), "EEE, d MMM yyyy")}
                      </TableCell>
                      <TableCell>
                        {override.isBlocked ? (
                          <Badge
                            variant="secondary"
                            className="bg-red-100 text-red-800"
                          >
                            Blocked
                          </Badge>
                        ) : (
                          <Badge
                            variant="secondary"
                            className="bg-blue-100 text-blue-800"
                          >
                            Custom Hours
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {override.isBlocked
                          ? override.reason || "Day off"
                          : `${override.startTime} – ${override.endTime}`}
                      </TableCell>
                      <TableCell>
                        <form
                          action={async () => {
                            "use server";
                            await deleteAvailabilityOverride(override.id);
                          }}
                        >
                          <Button
                            type="submit"
                            variant="ghost"
                            size="sm"
                            className="text-destructive hover:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </form>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
