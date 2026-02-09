export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Timer, Pencil, UserPlus, Newspaper } from "lucide-react";
import Link from "next/link";

const TYPE_META: Record<
  string,
  { label: string; icon: React.ComponentType<{ className?: string }>; count: number }
> = {
  onboarding: { label: "Onboarding Sequence", icon: UserPlus, count: 12 },
  newsletter: { label: "Newsletter Sequence", icon: Newspaper, count: 24 },
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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-bold">Drip Email Sequence</h1>
        <p className="text-sm text-muted-foreground">
          36-email automated nurture sequence. Contacts receive one email per scheduled day.
        </p>
      </div>

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
              Run the migration SQL to seed the 36 drip emails.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-8">
          {grouped.map((group) => {
            const Icon = group.meta.icon;
            return (
              <div key={group.type}>
                <div className="mb-3 flex items-center gap-2">
                  <Icon className="h-5 w-5 text-brand-500" />
                  <h2 className="font-heading text-lg font-semibold">
                    {group.meta.label}
                  </h2>
                  <Badge variant="outline" className="ml-1">
                    {group.emails.length} / {group.meta.count}
                  </Badge>
                </div>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {group.emails.map((email) => (
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
                        <p className="mb-3 text-sm font-medium line-clamp-2">
                          {email.subject}
                        </p>
                        <Button size="sm" variant="outline" className="gap-2" asChild>
                          <Link href={`/admin/drip-emails/${email.id}`}>
                            <Pencil className="h-3.5 w-3.5" />
                            Edit
                          </Link>
                        </Button>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
