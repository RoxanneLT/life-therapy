import { format } from "date-fns";
import { Receipt } from "lucide-react";
import Link from "next/link";
import { EmptyState } from "@/components/admin/empty-state";

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
  return `R ${(cents / 100).toLocaleString("en-ZA", {
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
  if (bookings.length === 0) {
    return (
      <EmptyState
        icon={Receipt}
        message="No unbilled sessions in the current billing period."
      />
    );
  }

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

  return (
    <div className="space-y-4">
      {/* Summary bar */}
      <div className="flex flex-wrap items-center gap-x-6 gap-y-1 rounded-lg border bg-muted/30 px-4 py-3 text-sm">
        <span className="text-muted-foreground">
          Period:{" "}
          <span className="font-medium text-foreground">
            {format(periodStart, "d MMM")} – {format(periodEnd, "d MMM yyyy")}
          </span>
        </span>
        <span className="text-muted-foreground">
          Billing date:{" "}
          <span className="font-medium text-foreground">
            {format(periodEnd, "d MMM yyyy")}
          </span>
        </span>
        <span className="text-muted-foreground">
          {totalClients} client{totalClients === 1 ? "" : "s"} ·{" "}
          {totalSessions} session{totalSessions === 1 ? "" : "s"}
        </span>
        <span className="ml-auto font-mono font-bold">Est. {fmt(grandTotal)}</span>
      </div>

      {/* Per-client groups */}
      {groups.map(({ student, bookings: studentBookings }) => {
        const { standingDiscountPercent: discPct, standingDiscountFixed: discFixed } = student;

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
            {/* Group header */}
            <div className="flex items-center justify-between border-b bg-muted/20 px-4 py-2.5">
              <Link
                href={`/admin/clients/${student.id}`}
                className="text-sm font-medium hover:underline"
              >
                {student.firstName} {student.lastName}
              </Link>
              <div className="flex items-center gap-2">
                {discountLabel && (
                  <span className="text-xs text-muted-foreground">{discountLabel}</span>
                )}
                <span className="font-mono text-sm font-semibold">{fmt(subtotal)}</span>
              </div>
            </div>

            {/* Session rows */}
            <table className="w-full text-sm">
              <tbody>
                {studentBookings.map((b) => {
                  const net =
                    b.priceZarCents > 0
                      ? applyDiscount(b.priceZarCents, discPct, discFixed)
                      : 0;
                  const typeLabel = SESSION_LABELS[b.sessionType] ?? b.sessionType;
                  let statusNote = "";
                  if (b.status === "no_show") statusNote = " · no-show";
                  else if (b.isLateCancel) statusNote = " · late cancel";

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
                        {b.startTime}–{b.endTime}
                      </td>
                      <td className="px-4 py-2 text-right font-mono">
                        {b.priceZarCents === 0 ? (
                          <span className="text-xs text-muted-foreground">credit</span>
                        ) : (
                          fmt(net)
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        );
      })}
    </div>
  );
}
