"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { RefreshCw, CheckCircle2, XCircle, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

interface SyncLogEntry {
  id: string;
  operation: string;
  status: string;
  graphEventId: string | null;
  errorMessage: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

interface CalendarSyncSectionProps {
  recentLogs: SyncLogEntry[];
  lastReconcileResult: Record<string, unknown> | null;
  lastReconcileAt: string | null;
}

export function CalendarSyncSection({
  recentLogs,
  lastReconcileResult,
  lastReconcileAt,
}: CalendarSyncSectionProps) {
  const [isPending, startTransition] = useTransition();
  const [reconcileResult, setReconcileResult] = useState<Record<string, unknown> | null>(null);

  function handleReconcile(autoFix: boolean) {
    if (
      !confirm(
        autoFix
          ? "Run reconciliation and auto-fix missing events? This creates new calendar events for bookings that are missing from Outlook."
          : "Run reconciliation in check-only mode? No changes will be made.",
      )
    )
      return;

    startTransition(async () => {
      try {
        const res = await fetch(`/api/admin/reconcile-calendar`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ autoFix }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Reconciliation failed");
        setReconcileResult(data);
        toast.success(
          `Reconciliation complete: ${data.matched} matched, ${data.mismatched?.length || 0} mismatched, ${data.fixed || 0} fixed`,
        );
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Reconciliation failed");
      }
    });
  }

  const statusIcon: Record<string, React.ReactNode> = {
    success: <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />,
    failed: <XCircle className="h-3.5 w-3.5 text-red-600" />,
    partial: <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />,
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Calendar Reconciliation</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {lastReconcileAt && (
            <p className="text-sm text-muted-foreground">
              Last run: {format(new Date(lastReconcileAt), "d MMM yyyy, HH:mm")}
              {lastReconcileResult && (
                <>
                  {" "}— {(lastReconcileResult as { matched?: number }).matched || 0} matched,{" "}
                  {(lastReconcileResult as { mismatched?: number }).mismatched || 0} mismatched,{" "}
                  {(lastReconcileResult as { fixed?: number }).fixed || 0} auto-fixed
                </>
              )}
            </p>
          )}
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleReconcile(false)}
              disabled={isPending}
            >
              <RefreshCw className={`mr-1 h-3.5 w-3.5 ${isPending ? "animate-spin" : ""}`} />
              Check Only
            </Button>
            <Button size="sm" onClick={() => handleReconcile(true)} disabled={isPending}>
              <RefreshCw className={`mr-1 h-3.5 w-3.5 ${isPending ? "animate-spin" : ""}`} />
              Check &amp; Auto-Fix
            </Button>
          </div>

          {reconcileResult && (
            <pre className="max-h-64 overflow-auto rounded bg-muted p-3 text-xs">
              {JSON.stringify(reconcileResult, null, 2)}
            </pre>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recent Sync Activity</CardTitle>
        </CardHeader>
        <CardContent>
          {recentLogs.length === 0 ? (
            <p className="text-sm text-muted-foreground">No sync activity recorded yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs text-muted-foreground">
                    <th className="px-3 py-2">Time</th>
                    <th className="px-3 py-2">Operation</th>
                    <th className="px-3 py-2">Status</th>
                    <th className="px-3 py-2">Details</th>
                  </tr>
                </thead>
                <tbody>
                  {recentLogs.map((log) => (
                    <tr key={log.id} className="border-b last:border-0">
                      <td className="whitespace-nowrap px-3 py-2 text-muted-foreground">
                        {format(new Date(log.createdAt), "d MMM HH:mm")}
                      </td>
                      <td className="px-3 py-2">{log.operation}</td>
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-1">
                          {statusIcon[log.status]}
                          <Badge
                            variant={
                              log.status === "success"
                                ? "default"
                                : log.status === "failed"
                                  ? "destructive"
                                  : "secondary"
                            }
                            className="text-xs"
                          >
                            {log.status}
                          </Badge>
                        </div>
                      </td>
                      <td className="px-3 py-2 text-xs text-muted-foreground">
                        {log.errorMessage ||
                          (log.metadata ? JSON.stringify(log.metadata).slice(0, 80) : "—")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
