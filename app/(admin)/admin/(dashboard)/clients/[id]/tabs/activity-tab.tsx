"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { saFormat } from "@/lib/dates";
import { isReadAction } from "@/lib/admin/audit-feed";
import { useClientActivity } from "../use-client-data";

const ENTITY_LABELS: Record<string, string> = {
  student: "Client",
  booking: "Session",
  payment_request: "Payment request",
  invoice: "Invoice",
  bulk: "Bulk",
};

/**
 * Who did what to this client's data, and who looked at it — read from audit_logs, which the
 * database refuses to change or delete (prisma/sql/80_ops.sql). Newest 200 rows.
 */
export function ActivityTab({ clientId }: Readonly<{ clientId: string }>) {
  const { data, isLoading, error } = useClientActivity(clientId);
  const [showReads, setShowReads] = useState(true);

  if (isLoading) return <p className="text-sm text-muted-foreground">Loading activity…</p>;
  if (error) return <p className="text-sm text-destructive">Could not load the activity log.</p>;

  const rows = (data ?? []).filter((r) => showReads || !isReadAction(r.action));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Every recorded change to this client&apos;s data, and every time someone viewed or exported it. Newest first, up to 200 entries.
        </p>
        <div className="flex items-center gap-2">
          <Switch id="activity-show-reads" checked={showReads} onCheckedChange={setShowReads} />
          <Label htmlFor="activity-show-reads" className="text-sm">Include views &amp; exports</Label>
        </div>
      </div>

      {rows.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">Nothing recorded yet.</CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="divide-y p-0">
            {rows.map((row) => (
              <div key={row.id} className="flex flex-col gap-1 px-4 py-3 sm:flex-row sm:gap-4">
                <div className="w-36 shrink-0 text-xs text-muted-foreground">
                  {saFormat(new Date(row.createdAt), "d MMM yyyy, HH:mm")}
                </div>
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium">{row.label}</span>
                    <Badge variant={isReadAction(row.action) ? "outline" : "secondary"} className="text-[10px]">
                      {ENTITY_LABELS[row.entityType] ?? row.entityType}
                    </Badge>
                  </div>
                  {row.changes.length > 0 && (
                    <ul className="space-y-0.5 text-xs text-muted-foreground">
                      {row.changes.map((c) => (
                        <li key={c} className="break-words">{c}</li>
                      ))}
                    </ul>
                  )}
                </div>
                <div className="shrink-0 text-xs text-muted-foreground sm:text-right">{row.actorEmail}</div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
