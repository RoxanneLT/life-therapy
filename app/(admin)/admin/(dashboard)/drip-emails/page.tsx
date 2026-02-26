export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Timer, Pencil, UserPlus, Newspaper, Plus, AlertTriangle, CircleSlash, CircleCheck,
  Brain, GraduationCap, CalendarOff, MessageSquareOff, Snowflake,
} from "lucide-react";
import Link from "next/link";
import { DeleteDripEmailButton } from "./delete-button";
import { DRIP_LINK_ISSUES, getWorstStatus, countIssues } from "@/lib/drip-link-audit";
import type { LinkAuditItem, EmailAudit } from "@/lib/drip-link-audit";

const TYPE_META: Record<
  string,
  { label: string; icon: React.ComponentType<{ className?: string }> }
> = {
  onboarding: { label: "Onboarding Sequence", icon: UserPlus },
  newsletter: { label: "Newsletter Sequence", icon: Newspaper },
};

export default async function DripEmailsPage() {
  await requireRole("super_admin", "marketing");

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

  const grouped = (["onboarding", "newsletter"] as const).map((type) => ({
    type,
    meta: TYPE_META[type],
    emails: dripEmails.filter((e) => e.type === type),
  }));

  const totalEmails = dripEmails.length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-bold">Drip Email Sequence</h1>
        <p className="text-sm text-muted-foreground">
          {totalEmails}-email automated nurture sequence. Contacts receive one email per scheduled day.
        </p>
      </div>

      {/* ── Smart Behaviour Panel ── */}
      <Card className="border-brand-200 bg-gradient-to-br from-brand-50/50 to-white">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-100">
              <Brain className="h-4 w-4 text-brand-700" />
            </div>
            <div>
              <h2 className="text-sm font-semibold">Smart Drip Behaviours</h2>
              <p className="text-xs text-muted-foreground">Active intelligence layers that adapt the sequence per client</p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">

            {/* 1. Auto-graduate */}
            <div className="rounded-lg border bg-white p-3">
              <div className="mb-2 flex items-center gap-2">
                <GraduationCap className="h-4 w-4 text-emerald-600" />
                <span className="text-xs font-semibold text-emerald-800">Auto-Graduate</span>
                <Badge variant="outline" className="ml-auto border-emerald-200 bg-emerald-50 text-emerald-700 text-[10px] px-1.5 py-0">
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
            <div className="rounded-lg border bg-white p-3">
              <div className="mb-2 flex items-center gap-2">
                <CalendarOff className="h-4 w-4 text-blue-600" />
                <span className="text-xs font-semibold text-blue-800">Skip Consultation CTAs</span>
                <Badge variant="outline" className="ml-auto border-blue-200 bg-blue-50 text-blue-700 text-[10px] px-1.5 py-0">
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
            <div className="rounded-lg border bg-white p-3">
              <div className="mb-2 flex items-center gap-2">
                <MessageSquareOff className="h-4 w-4 text-violet-600" />
                <span className="text-xs font-semibold text-violet-800">Strip Inline Links</span>
                <Badge variant="outline" className="ml-auto border-violet-200 bg-violet-50 text-violet-700 text-[10px] px-1.5 py-0">
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
            <div className="rounded-lg border bg-white p-3">
              <div className="mb-2 flex items-center gap-2">
                <Snowflake className="h-4 w-4 text-cyan-600" />
                <span className="text-xs font-semibold text-cyan-800">Cold Client Pause</span>
                <Badge variant="outline" className="ml-auto border-cyan-200 bg-cyan-50 text-cyan-700 text-[10px] px-1.5 py-0">
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
      </Card>

      {/* Link readiness summary */}
      {(() => {
        const allAudits: EmailAudit[] = Object.entries(DRIP_LINK_ISSUES).map(([key, issues]) => ({
          key,
          subject: "",
          issues,
        }));
        const counts = countIssues(allAudits);
        const missingCount = counts.missing;
        const needsContentCount = counts.noContent;
        if (missingCount === 0 && needsContentCount === 0) return null;
        return (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
            <div className="flex items-center gap-2 mb-1">
              <AlertTriangle className="h-4 w-4 text-amber-600" />
              <span className="text-sm font-semibold text-amber-800">Drip Sequence Readiness</span>
            </div>
            <p className="text-xs text-amber-700">
              {missingCount > 0 && <><strong className="text-red-700">{missingCount} missing route{missingCount !== 1 ? "s" : ""}</strong> (page doesn&apos;t exist yet) &middot; </>}
              {needsContentCount > 0 && <><strong>{needsContentCount} need content</strong> (route exists but no product/course in database)</>}
              {missingCount === 0 && needsContentCount > 0 && <> &mdash; create the products/courses in admin to wire these up</>}
            </p>
          </div>
        );
      })()}

      {/* Stats */}
      <div className="grid gap-3 sm:grid-cols-4">
        {[
          { label: "Total in Drip", value: totalInDrip },
          { label: "In Onboarding", value: inOnboarding },
          { label: "In Newsletter", value: inNewsletter },
          { label: "Completed", value: completed },
        ].map((stat) => (
          <Card key={stat.label}>
            <CardContent className="pb-4 pt-4">
              <p className="text-2xl font-bold">{stat.value}</p>
              <p className="text-xs text-muted-foreground">{stat.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Empty state */}
      {dripEmails.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center py-12 text-center">
            <Timer className="mb-4 h-12 w-12 text-muted-foreground" />
            <h3 className="font-heading text-lg font-semibold">No drip emails found</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Run the migration SQL to seed the drip emails, or add new ones below.
            </p>
            <div className="mt-4 flex gap-2">
              <Button size="sm" asChild>
                <Link href="/admin/drip-emails/new?type=onboarding">
                  <Plus className="mr-2 h-4 w-4" />
                  Add Onboarding Email
                </Link>
              </Button>
              <Button size="sm" asChild>
                <Link href="/admin/drip-emails/new?type=newsletter">
                  <Plus className="mr-2 h-4 w-4" />
                  Add Newsletter Email
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-8">
          {grouped.map((group) => {
            const Icon = group.meta.icon;
            return (
              <div key={group.type}>
                <div className="mb-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Icon className="h-5 w-5 text-brand-500" />
                    <h2 className="font-heading text-lg font-semibold">
                      {group.meta.label}
                    </h2>
                    <Badge variant="outline" className="ml-1">
                      {group.emails.length} emails
                    </Badge>
                  </div>
                  <Button size="sm" variant="outline" className="gap-2" asChild>
                    <Link href={`/admin/drip-emails/new?type=${group.type}`}>
                      <Plus className="h-4 w-4" />
                      Add Email
                    </Link>
                  </Button>
                </div>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {group.emails.map((email) => {
                    const auditKey = `${group.type}_${email.step}`;
                    const issues = DRIP_LINK_ISSUES[auditKey];
                    const worstStatus = getWorstStatus(auditKey);
                    const nonReadyIssues = issues?.filter((i: LinkAuditItem) => i.status !== "ready" && i.status !== "dynamic") || [];

                    // Smart behaviour flags for this specific email
                    const consultationSkipSteps: Record<string, number[]> = {
                      onboarding: [11],
                      newsletter: [5, 11, 31, 38],
                    };
                    const consultationStripSteps: Record<string, number[]> = {
                      onboarding: [7],
                      newsletter: [3],
                    };
                    const isConsultationSkip = (consultationSkipSteps[group.type] || []).includes(email.step);
                    const isConsultationStrip = (consultationStripSteps[group.type] || []).includes(email.step);

                    return (
                    <Card key={email.id} className="transition-shadow hover:shadow-md">
                      <CardHeader className="pb-2">
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="shrink-0 text-xs">
                              #{email.step + 1}
                            </Badge>
                            <span className="text-xs text-muted-foreground">
                              Day {email.dayOffset}
                            </span>
                          </div>
                          <Badge
                            variant={email.isActive ? "default" : "secondary"}
                            className="shrink-0"
                          >
                            {email.isActive ? "Active" : "Inactive"}
                          </Badge>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <p className="mb-2 text-sm font-medium line-clamp-2">
                          {email.subject}
                        </p>

                        {/* Readiness badge */}
                        {worstStatus === "missing" && (
                          <div className="mb-3 flex items-start gap-1.5 rounded-md bg-red-50 px-2.5 py-1.5 text-xs text-red-700">
                            <CircleSlash className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                            <div>
                              <span className="font-semibold">Route missing</span>
                              {nonReadyIssues.map((issue: LinkAuditItem, i: number) => (
                                <p key={i} className="text-red-600">{issue.note}</p>
                              ))}
                            </div>
                          </div>
                        )}
                        {worstStatus === "no_content" && (
                          <div className="mb-3 flex items-start gap-1.5 rounded-md bg-amber-50 px-2.5 py-1.5 text-xs text-amber-700">
                            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                            <div>
                              <span className="font-semibold">Needs content</span>
                              {nonReadyIssues.map((issue: LinkAuditItem, i: number) => (
                                <p key={i} className="text-amber-600">{issue.note}</p>
                              ))}
                            </div>
                          </div>
                        )}
                        {worstStatus === "ready" && issues && issues.length > 0 && (
                          <div className="mb-3 flex items-center gap-1.5 text-xs text-green-600">
                            <CircleCheck className="h-3.5 w-3.5" />
                            <span>All links verified</span>
                          </div>
                        )}

                        {/* Smart behaviour indicators */}
                        {(isConsultationSkip || isConsultationStrip) && (
                          <div className="mb-3 flex flex-wrap gap-1.5">
                            {isConsultationSkip && (
                              <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-medium text-blue-700 ring-1 ring-inset ring-blue-200">
                                <CalendarOff className="h-2.5 w-2.5" />
                                Skipped if consulted
                              </span>
                            )}
                            {isConsultationStrip && (
                              <span className="inline-flex items-center gap-1 rounded-full bg-violet-50 px-2 py-0.5 text-[10px] font-medium text-violet-700 ring-1 ring-inset ring-violet-200">
                                <MessageSquareOff className="h-2.5 w-2.5" />
                                Link stripped if consulted
                              </span>
                            )}
                          </div>
                        )}

                        <div className="flex gap-2">
                          <Button size="sm" variant="outline" className="gap-2" asChild>
                            <Link href={`/admin/drip-emails/${email.id}`}>
                              <Pencil className="h-3.5 w-3.5" />
                              Edit
                            </Link>
                          </Button>
                          <DeleteDripEmailButton id={email.id} step={email.step + 1} />
                        </div>
                      </CardContent>
                    </Card>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
