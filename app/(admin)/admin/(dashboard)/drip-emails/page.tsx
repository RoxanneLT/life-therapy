export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { Card, CardContent } from "@/components/ui/card";
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
import {
  Timer, Pencil, UserPlus, Newspaper, Plus, AlertTriangle, CircleSlash, CircleCheck,
  CalendarOff, MessageSquareOff,
} from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { DeleteDripEmailButton } from "./delete-button";
import { SmartBehavioursPanel } from "./smart-behaviours-panel";
import { DRIP_LINK_ISSUES, getWorstStatus, countIssues } from "@/lib/drip-link-audit";
import type { LinkAuditItem, EmailAudit } from "@/lib/drip-link-audit";

const TYPE_META: Record<
  string,
  { label: string; icon: React.ComponentType<{ className?: string }> }
> = {
  onboarding: { label: "Onboarding", icon: UserPlus },
  newsletter: { label: "Newsletter", icon: Newspaper },
};

const DRIP_TYPES = ["onboarding", "newsletter"] as const;
type DripType = (typeof DRIP_TYPES)[number];

// Steps whose consultation CTA is skipped / stripped when a client has consulted.
const CONSULTATION_SKIP_STEPS: Record<string, number[]> = {
  onboarding: [11],
  newsletter: [5, 11, 31, 38],
};
const CONSULTATION_STRIP_STEPS: Record<string, number[]> = {
  onboarding: [7],
  newsletter: [3],
};

export default async function DripEmailsPage({
  searchParams,
}: {
  readonly searchParams: Promise<{ tab?: string }>;
}) {
  await requireRole("super_admin", "marketing");

  const { tab } = await searchParams;
  const activeType: DripType = DRIP_TYPES.includes(tab as DripType)
    ? (tab as DripType)
    : "onboarding";

  const dripEmails = await prisma.dripEmail.findMany({
    orderBy: [{ type: "asc" }, { step: "asc" }],
  });

  // Stats
  const [totalInDrip, inOnboarding, inNewsletter, completed] = await Promise.all([
    prisma.dripProgress.count(),
    prisma.dripProgress.count({ where: { currentPhase: "onboarding", completedAt: null } }),
    prisma.dripProgress.count({ where: { currentPhase: "newsletter", completedAt: null } }),
    prisma.dripProgress.count({ where: { completedAt: { not: null } } }),
  ]);

  const countByType = (type: DripType) => dripEmails.filter((e) => e.type === type).length;

  // Active tab's emails, in day sequence
  const activeEmails = dripEmails
    .filter((e) => e.type === activeType)
    .sort((a, b) => a.dayOffset - b.dayOffset || a.step - b.step);

  const totalEmails = dripEmails.length;

  // Link readiness counts (for the header banner)
  const allAudits: EmailAudit[] = Object.entries(DRIP_LINK_ISSUES).map(([key, issues]) => ({
    key,
    subject: "",
    issues,
  }));
  const readiness = countIssues(allAudits);

  return (
    <div className="flex h-full flex-col">
      {/* Fixed header — title, smart-behaviours reference, stats and tabs all stay put */}
      <div className="shrink-0 -mx-6 -mt-6 bg-background px-6 pt-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="min-w-0">
            <h1 className="font-heading text-2xl font-bold leading-tight">Drip Email Sequence</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {totalEmails}-email automated nurture sequence. Contacts receive one email per scheduled day.
            </p>
          </div>
          <Button size="sm" asChild>
            <Link href={`/admin/drip-emails/new?type=${activeType}`}>
              <Plus className="mr-1.5 h-3.5 w-3.5" />
              Add Email
            </Link>
          </Button>
        </div>

        {/* Smart behaviours — collapsible reference (above the tabs, shown once) */}
        <div className="mt-3">
          <SmartBehavioursPanel />
        </div>

        {/* Compact stats + link readiness */}
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
          <span><strong className="text-foreground">{totalInDrip}</strong> in drip</span>
          <span><strong className="text-foreground">{inOnboarding}</strong> onboarding</span>
          <span><strong className="text-foreground">{inNewsletter}</strong> newsletter</span>
          <span><strong className="text-foreground">{completed}</strong> completed</span>
          {(readiness.missing > 0 || readiness.noContent > 0) && (
            <span className="inline-flex items-center gap-1 text-amber-700">
              <AlertTriangle className="h-3.5 w-3.5" />
              {readiness.missing > 0 && <><strong>{readiness.missing}</strong> missing route{readiness.missing !== 1 ? "s" : ""}</>}
              {readiness.missing > 0 && readiness.noContent > 0 && " · "}
              {readiness.noContent > 0 && <><strong>{readiness.noContent}</strong> need content</>}
            </span>
          )}
        </div>

        {/* Tabs */}
        <div className="mt-3 flex gap-1 border-b border-border">
          {DRIP_TYPES.map((type) => {
            const Icon = TYPE_META[type].icon;
            return (
              <Link
                key={type}
                href={`/admin/drip-emails?tab=${type}`}
                className={cn(
                  "flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm font-medium transition-colors -mb-px",
                  activeType === type
                    ? "border-brand-600 text-brand-700"
                    : "border-transparent text-muted-foreground hover:border-border hover:text-foreground",
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                {TYPE_META[type].label}
                <Badge variant="outline" className="ml-1 px-1.5 py-0 text-[10px]">
                  {countByType(type)}
                </Badge>
              </Link>
            );
          })}
        </div>
      </div>

      {/* Scrollable content — only the table scrolls */}
      <div className="mt-4 min-h-0 flex-1">
        {activeEmails.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center py-12 text-center">
              <Timer className="mb-4 h-12 w-12 text-muted-foreground" />
              <h3 className="font-heading text-lg font-semibold">
                No {TYPE_META[activeType].label.toLowerCase()} emails yet
              </h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Add the first email in this sequence.
              </p>
              <Button size="sm" className="mt-4" asChild>
                <Link href={`/admin/drip-emails/new?type=${activeType}`}>
                  <Plus className="mr-2 h-4 w-4" />
                  Add {TYPE_META[activeType].label} Email
                </Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="flex max-h-full flex-col overflow-hidden rounded-md border bg-card">
            <Table containerClassName="min-h-0 flex-1">
              <TableHeader className="sticky top-0 z-10 bg-card">
                <TableRow>
                  <TableHead className="w-16">Step</TableHead>
                  <TableHead className="w-20">Day</TableHead>
                  <TableHead>Subject</TableHead>
                  <TableHead className="w-24">Status</TableHead>
                  <TableHead>Links</TableHead>
                  <TableHead className="w-24 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {activeEmails.map((email) => {
                  const auditKey = `${activeType}_${email.step}`;
                  const issues = DRIP_LINK_ISSUES[auditKey];
                  const worstStatus = getWorstStatus(auditKey);
                  const nonReadyIssues = issues?.filter((i: LinkAuditItem) => i.status !== "ready" && i.status !== "dynamic") || [];
                  const isConsultationSkip = (CONSULTATION_SKIP_STEPS[activeType] || []).includes(email.step);
                  const isConsultationStrip = (CONSULTATION_STRIP_STEPS[activeType] || []).includes(email.step);

                  return (
                    <TableRow key={email.id}>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">#{email.step + 1}</Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        Day {email.dayOffset}
                      </TableCell>
                      <TableCell>
                        <p className="font-medium">{email.subject}</p>
                        {(isConsultationSkip || isConsultationStrip) && (
                          <div className="mt-1 flex flex-wrap gap-1.5">
                            {isConsultationSkip && (
                              <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-medium text-blue-700 ring-1 ring-inset ring-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:ring-blue-900">
                                <CalendarOff className="h-2.5 w-2.5" />
                                Skipped if consulted
                              </span>
                            )}
                            {isConsultationStrip && (
                              <span className="inline-flex items-center gap-1 rounded-full bg-violet-50 px-2 py-0.5 text-[10px] font-medium text-violet-700 ring-1 ring-inset ring-violet-200 dark:bg-violet-950/40 dark:text-violet-300 dark:ring-violet-900">
                                <MessageSquareOff className="h-2.5 w-2.5" />
                                Link stripped if consulted
                              </span>
                            )}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant={email.isActive ? "default" : "secondary"}>
                          {email.isActive ? "Active" : "Inactive"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {worstStatus === "missing" ? (
                          <span
                            className="inline-flex items-center gap-1 text-xs font-medium text-red-700"
                            title={nonReadyIssues.map((i: LinkAuditItem) => i.note).join(" · ")}
                          >
                            <CircleSlash className="h-3.5 w-3.5" />
                            Route missing
                          </span>
                        ) : worstStatus === "no_content" ? (
                          <span
                            className="inline-flex items-center gap-1 text-xs font-medium text-amber-700"
                            title={nonReadyIssues.map((i: LinkAuditItem) => i.note).join(" · ")}
                          >
                            <AlertTriangle className="h-3.5 w-3.5" />
                            Needs content
                          </span>
                        ) : worstStatus === "ready" && issues && issues.length > 0 ? (
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-green-600">
                            <CircleCheck className="h-3.5 w-3.5" />
                            Verified
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="icon" asChild aria-label="Edit email">
                            <Link href={`/admin/drip-emails/${email.id}`}>
                              <Pencil className="h-4 w-4" />
                            </Link>
                          </Button>
                          <DeleteDripEmailButton id={email.id} step={email.step + 1} />
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </div>
  );
}
