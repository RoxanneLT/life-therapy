"use client";

import { useState, useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { Search } from "lucide-react";

interface LogEntry {
  id: string;
  to: string;
  status: string;
  templateKey: string | null;
  openedAt: string | null;
  opensCount: number;
  clickedAt: string | null;
  clicksCount: number;
  sentAt: string;
  error: string | null;
}

interface DeliveryLogProps {
  logs: LogEntry[];
  isMultiStep: boolean;
  totalSteps: number;
}

export function DeliveryLog({ logs, isMultiStep, totalSteps }: Readonly<DeliveryLogProps>) {
  const [stepFilter, setStepFilter] = useState<number | "all" | "failed">("all");
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    let result = logs;

    // Step / status filter
    if (stepFilter === "failed") {
      result = result.filter((l) => l.status === "failed");
    } else if (stepFilter !== "all" && isMultiStep) {
      result = result.filter((l) => {
        const step = Number(l.templateKey?.split("_").pop());
        return step === stepFilter;
      });
    }

    // Search by email
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter((l) => l.to.toLowerCase().includes(q));
    }

    return result;
  }, [logs, stepFilter, search, isMultiStep]);

  const failedCount = logs.filter((l) => l.status === "failed").length;

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle className="text-base">
            Delivery Log ({filtered.length}{filtered.length !== logs.length ? ` of ${logs.length}` : ""})
          </CardTitle>
          <div className="relative w-full sm:w-56">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-8 pl-8 text-sm"
            />
          </div>
        </div>
        {/* Filter tabs */}
        {isMultiStep && (
          <div className="flex flex-wrap gap-1.5 pt-2">
            <FilterTab
              label="All"
              active={stepFilter === "all"}
              onClick={() => setStepFilter("all")}
            />
            {Array.from({ length: totalSteps }, (_, i) => {
              const count = logs.filter((l) => {
                const step = Number(l.templateKey?.split("_").pop());
                return step === i;
              }).length;
              return (
                <FilterTab
                  key={i}
                  label={`Step ${i + 1}`}
                  count={count}
                  active={stepFilter === i}
                  onClick={() => setStepFilter(i)}
                />
              );
            })}
            {failedCount > 0 && (
              <FilterTab
                label="Failed"
                count={failedCount}
                active={stepFilter === "failed"}
                onClick={() => setStepFilter("failed")}
                variant="destructive"
              />
            )}
          </div>
        )}
        {!isMultiStep && failedCount > 0 && (
          <div className="flex gap-1.5 pt-2">
            <FilterTab
              label="All"
              active={stepFilter === "all"}
              onClick={() => setStepFilter("all")}
            />
            <FilterTab
              label="Failed"
              count={failedCount}
              active={stepFilter === "failed"}
              onClick={() => setStepFilter("failed")}
              variant="destructive"
            />
          </div>
        )}
      </CardHeader>
      <CardContent>
        {filtered.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            {search ? "No matching emails found." : "No delivery logs yet."}
          </p>
        ) : (
          <div className="max-h-[500px] overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Email</TableHead>
                  {isMultiStep && <TableHead>Step</TableHead>}
                  <TableHead>Status</TableHead>
                  <TableHead>Opened</TableHead>
                  <TableHead>Clicked</TableHead>
                  <TableHead>Sent At</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="text-muted-foreground">{log.to}</TableCell>
                    {isMultiStep && (
                      <TableCell>
                        {log.templateKey?.split("_").pop() === undefined
                          ? "—"
                          : `Step ${Number(log.templateKey?.split("_").pop()) + 1}`}
                      </TableCell>
                    )}
                    <TableCell>
                      <Badge variant={log.status === "sent" ? "secondary" : "destructive"}>
                        {log.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {log.openedAt ? (
                        <span className="text-green-600" title={format(new Date(log.openedAt), "d MMM HH:mm")}>
                          Yes ({log.opensCount})
                        </span>
                      ) : (
                        <span className="text-muted-foreground">No</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {log.clickedAt ? (
                        <span className="text-blue-600" title={format(new Date(log.clickedAt), "d MMM HH:mm")}>
                          Yes ({log.clicksCount})
                        </span>
                      ) : (
                        <span className="text-muted-foreground">No</span>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {format(new Date(log.sentAt), "d MMM HH:mm")}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function FilterTab({
  label,
  count,
  active,
  onClick,
  variant,
}: {
  label: string;
  count?: number;
  active: boolean;
  onClick: () => void;
  variant?: "destructive";
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
        active
          ? variant === "destructive"
            ? "bg-destructive/10 text-destructive"
            : "bg-primary/10 text-primary"
          : "bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground"
      )}
    >
      {label}
      {count !== undefined && (
        <span className={cn(
          "rounded-full px-1.5 py-0.5 text-[10px]",
          active ? "bg-background/50" : "bg-background"
        )}>
          {count}
        </span>
      )}
    </button>
  );
}
