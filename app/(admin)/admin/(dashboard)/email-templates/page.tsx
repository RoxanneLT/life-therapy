export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Mail, Pencil, CalendarDays, ShoppingCart, UserPlus, GraduationCap, Gift } from "lucide-react";
import Link from "next/link";

const CATEGORY_META: Record<string, { label: string; icon: React.ComponentType<{ className?: string }> }> = {
  booking: { label: "Booking Emails", icon: CalendarDays },
  order: { label: "Order Emails", icon: ShoppingCart },
  onboarding: { label: "Onboarding Emails", icon: UserPlus },
  course: { label: "Course Emails", icon: GraduationCap },
  gift: { label: "Gift Emails", icon: Gift },
};

const CATEGORY_ORDER = ["booking", "order", "onboarding", "course", "gift"];

export default async function EmailTemplatesPage() {
  const templates = await prisma.emailTemplate.findMany({
    orderBy: [{ category: "asc" }, { key: "asc" }],
  });

  // Group by category
  const grouped = CATEGORY_ORDER.map((cat) => ({
    category: cat,
    meta: CATEGORY_META[cat] || { label: cat, icon: Mail },
    templates: templates.filter((t) => t.category === cat),
  })).filter((g) => g.templates.length > 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold">Email Templates</h1>
          <p className="text-sm text-muted-foreground">
            View and edit all email templates sent by the system.
          </p>
        </div>
      </div>

      {templates.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center py-12 text-center">
            <Mail className="mb-4 h-12 w-12 text-muted-foreground" />
            <h3 className="font-heading text-lg font-semibold">
              No templates found
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Run the migration SQL to seed email templates.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-8">
          {grouped.map((group) => {
            const Icon = group.meta.icon;
            return (
              <div key={group.category}>
                <div className="mb-3 flex items-center gap-2">
                  <Icon className="h-5 w-5 text-brand-500" />
                  <h2 className="font-heading text-lg font-semibold">
                    {group.meta.label}
                  </h2>
                  <Badge variant="outline" className="ml-1">
                    {group.templates.length}
                  </Badge>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  {group.templates.map((template) => (
                    <Card key={template.key} className="transition-shadow hover:shadow-md">
                      <CardHeader className="pb-2">
                        <div className="flex items-start justify-between">
                          <CardTitle className="text-sm font-medium">
                            {template.name}
                          </CardTitle>
                          <Badge
                            variant={template.isActive ? "default" : "secondary"}
                            className="ml-2 shrink-0"
                          >
                            {template.isActive ? "Active" : "Inactive"}
                          </Badge>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <p className="mb-3 text-xs text-muted-foreground line-clamp-1">
                          Subject: {template.subject}
                        </p>
                        <Button size="sm" variant="outline" className="gap-2" asChild>
                          <Link href={`/admin/email-templates/${template.key}`}>
                            <Pencil className="h-3.5 w-3.5" />
                            Edit Template
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
