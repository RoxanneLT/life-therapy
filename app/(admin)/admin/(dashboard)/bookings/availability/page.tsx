export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { requireAccess } from "@/lib/auth";
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
import { Trash2 } from "lucide-react";
import { PageHeader } from "@/components/admin/page-header";

export default async function AvailabilityOverridesPage() {
  await requireAccess("/admin/bookings/availability");

  const overrides = await prisma.availabilityOverride.findMany({
    orderBy: { date: "asc" },
  });

  return (
    <div className="space-y-6">
      <PageHeader
        back={{ href: "/admin/bookings", to: "Bookings" }}
        title="Availability Overrides"
        description="Block off dates or set custom hours for specific days. These override your regular business hours."
      />

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
            <div className="rounded-md border bg-card">
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
                        {/* The shape is read from the row, never from a stored mode flag —
                            see createAvailabilityOverride. */}
                        {override.isBlocked ? (
                          <Badge
                            variant="secondary"
                            className="bg-red-100 text-red-800"
                          >
                            Blocked
                          </Badge>
                        ) : override.openSlots.length > 0 ? (
                          <Badge
                            variant="secondary"
                            className="bg-green-100 text-green-800"
                          >
                            Chosen Slots
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
                          : override.openSlots.length > 0
                            ? override.openSlots.join(", ")
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
