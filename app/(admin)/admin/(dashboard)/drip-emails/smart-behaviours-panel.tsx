"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Brain,
  GraduationCap,
  CalendarOff,
  MessageSquareOff,
  Snowflake,
  ChevronDown,
} from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Reference panel explaining the smart drip behaviours. Collapsed by default to
 * keep the page focused on the sequence table — expand when you need to recall
 * how the automation adapts per client.
 */
export function SmartBehavioursPanel() {
  const [open, setOpen] = useState(false);

  return (
    <Card className="border-brand-200 bg-linear-to-br from-brand-50/50 to-white dark:border-brand-900 dark:from-brand-950/20 dark:to-background">
      <CardHeader className={open ? "pb-3" : "py-3"}>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex w-full items-center gap-2 text-left"
          aria-expanded={open}
        >
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-100 dark:bg-brand-900/50">
            <Brain className="h-4 w-4 text-brand-700 dark:text-brand-300" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-sm font-semibold">Smart Drip Behaviours</h2>
            <p className="text-xs text-muted-foreground">
              Active intelligence layers that adapt the sequence per client
            </p>
          </div>
          <span className="flex shrink-0 items-center gap-1 text-xs font-medium text-muted-foreground">
            {open ? "Hide" : "Show"}
            <ChevronDown className={cn("h-4 w-4 transition-transform", open && "rotate-180")} />
          </span>
        </button>
      </CardHeader>

      {open && (
        <CardContent className="pt-0">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">

            {/* 1. Auto-graduate */}
            <div className="rounded-lg border bg-card p-3">
              <div className="mb-2 flex items-center gap-2">
                <GraduationCap className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                <span className="text-xs font-semibold text-emerald-800 dark:text-emerald-300">Auto-Graduate</span>
                <Badge variant="outline" className="ml-auto border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300 text-[10px] px-1.5 py-0">
                  Active
                </Badge>
              </div>
              <p className="text-[11px] leading-relaxed text-muted-foreground">
                When a potential client converts to <strong>active</strong> (or inactive), they immediately skip remaining onboarding and jump to newsletter.
              </p>
              <p className="mt-1.5 text-[10px] text-muted-foreground/70">
                Trigger: clientStatus ≠ &quot;potential&quot; while in onboarding phase
              </p>
            </div>

            {/* 2. Skip consultation emails */}
            <div className="rounded-lg border bg-card p-3">
              <div className="mb-2 flex items-center gap-2">
                <CalendarOff className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                <span className="text-xs font-semibold text-blue-800 dark:text-blue-300">Skip Consultation CTAs</span>
                <Badge variant="outline" className="ml-auto border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-300 text-[10px] px-1.5 py-0">
                  Active
                </Badge>
              </div>
              <p className="text-[11px] leading-relaxed text-muted-foreground">
                If a client already has a free consultation (booked, confirmed, or done), emails whose primary CTA is &quot;Book a Free Consultation&quot; are <strong>skipped entirely</strong>.
              </p>
              <p className="mt-1.5 text-[10px] text-muted-foreground/70">
                Affects: onboarding #12 · newsletter #6, #12, #32, #39
              </p>
            </div>

            {/* 3. Strip inline links */}
            <div className="rounded-lg border bg-card p-3">
              <div className="mb-2 flex items-center gap-2">
                <MessageSquareOff className="h-4 w-4 text-violet-600 dark:text-violet-400" />
                <span className="text-xs font-semibold text-violet-800 dark:text-violet-300">Strip Inline Links</span>
                <Badge variant="outline" className="ml-auto border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-900 dark:bg-violet-950/40 dark:text-violet-300 text-[10px] px-1.5 py-0">
                  Active
                </Badge>
              </div>
              <p className="text-[11px] leading-relaxed text-muted-foreground">
                Emails that mention free consultation <strong>in passing</strong> but have a different primary CTA — the booking link is replaced with &quot;reach out to me directly&quot;.
              </p>
              <p className="mt-1.5 text-[10px] text-muted-foreground/70">
                Affects: onboarding #8 · newsletter #4
              </p>
            </div>

            {/* 4. Cold client auto-pause */}
            <div className="rounded-lg border bg-card p-3">
              <div className="mb-2 flex items-center gap-2">
                <Snowflake className="h-4 w-4 text-cyan-600 dark:text-cyan-400" />
                <span className="text-xs font-semibold text-cyan-800 dark:text-cyan-300">Cold Client Pause</span>
                <Badge variant="outline" className="ml-auto border-cyan-200 bg-cyan-50 text-cyan-700 dark:border-cyan-900 dark:bg-cyan-950/40 dark:text-cyan-300 text-[10px] px-1.5 py-0">
                  Active
                </Badge>
              </div>
              <p className="text-[11px] leading-relaxed text-muted-foreground">
                If a client has <strong>5 consecutive tracked emails</strong> with zero opens, they are automatically paused from further drip emails.
              </p>
              <p className="mt-1.5 text-[10px] text-muted-foreground/70">
                Resumable from client profile · reason logged as &quot;5_consecutive_unopened&quot;
              </p>
            </div>

          </div>
        </CardContent>
      )}
    </Card>
  );
}
