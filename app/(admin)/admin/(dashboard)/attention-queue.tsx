import Link from "next/link";
import { AlertTriangle, ArrowRight, CheckCircle2 } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { DashboardCardTitle } from "./dashboard-card-title";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { getAttentionItems, type AttentionItem } from "@/lib/dashboard-attention";
import type { AdminRole } from "@/lib/generated/prisma/client";
import { MarkAllCompletedButton } from "./mark-all-completed-button";

const DOT: Record<AttentionItem["priority"], string> = {
  1: "bg-red-500",
  2: "bg-amber-500",
  3: "bg-sky-500",
};

/** "Needs attention": everything waiting on a person, most urgent first. Streams behind Suspense. */
export async function AttentionQueue({ role }: Readonly<{ role: AdminRole }>) {
  const items = await getAttentionItems(role);

  return (
    <Card className="h-full">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <DashboardCardTitle icon={AlertTriangle}>Needs attention</DashboardCardTitle>
        {items.length > 0 && (
          <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700 dark:bg-red-900/40 dark:text-red-300">
            {items.length}
          </span>
        )}
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <CheckCircle2 className="h-4 w-4 text-green-600" />
            Nothing is waiting on you.
          </p>
        ) : (
          <ul className="divide-y">
            {items.map((item) => (
              <li key={item.key} className="flex flex-wrap items-start gap-3 py-3 first:pt-0 last:pb-0">
                <span className={cn("mt-1.5 h-2 w-2 shrink-0 rounded-full", DOT[item.priority])} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{item.title}</p>
                  {item.detail && <p className="text-xs text-muted-foreground">{item.detail}</p>}
                  {item.entries && item.entries.length > 0 && (
                    <ul className="mt-1 space-y-0.5 text-xs">
                      {item.entries.map((e, i) => (
                        <li key={`${e.label}-${i}`} className="truncate">
                          {e.href ? (
                            <Link href={e.href} className="font-medium underline-offset-2 hover:underline">
                              {e.label}
                            </Link>
                          ) : (
                            <span className="font-medium">{e.label}</span>
                          )}
                          {e.detail && <span className="text-muted-foreground"> · {e.detail}</span>}
                        </li>
                      ))}
                      {item.count > item.entries.length && (
                        <li className="text-muted-foreground">+{item.count - item.entries.length} more</li>
                      )}
                    </ul>
                  )}
                </div>
                <div className="flex shrink-0 gap-2">
                  {item.action === "mark-stale-completed" && <MarkAllCompletedButton count={item.count} />}
                  {item.href && (
                    <Button asChild size="sm" variant="outline">
                      <Link href={item.href}>
                        Review
                        <ArrowRight className="ml-1 h-3.5 w-3.5" />
                      </Link>
                    </Button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

export function AttentionQueueSkeleton() {
  return (
    <div className="animate-pulse space-y-3 rounded-xl border bg-card p-6">
      <div className="h-5 w-36 rounded bg-muted" />
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="flex gap-3">
          <div className="mt-1.5 h-2 w-2 rounded-full bg-muted" />
          <div className="flex-1 space-y-1.5">
            <div className="h-4 w-2/3 rounded bg-muted" />
            <div className="h-3 w-1/2 rounded bg-muted" />
          </div>
        </div>
      ))}
    </div>
  );
}
