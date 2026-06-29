export const dynamic = "force-dynamic";

import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { getSettingsPageVisits } from "@/lib/settings-ui-state";
import {
  SETTINGS_CATALOG,
  SETTINGS_NAV_GROUPS,
  topVisitedHrefs,
  type SettingsPage,
} from "@/lib/settings-catalog";
import { SettingsPageHeader } from "@/components/admin/settings/settings-page-header";
import { Card } from "@/components/ui/card";

function SettingCard({ page }: Readonly<{ page: SettingsPage }>) {
  const Icon = page.icon;
  return (
    <Link href={page.href} className="group block">
      <Card className="h-full p-4 transition-colors group-hover:border-brand-300 group-hover:bg-muted/40">
        <div className="flex items-start gap-3">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border bg-muted/40 text-muted-foreground">
            <Icon className="h-[18px] w-[18px]" />
          </span>
          <div className="min-w-0">
            <p className="font-heading text-sm font-semibold">{page.title}</p>
            <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{page.desc}</p>
          </div>
        </div>
      </Card>
    </Link>
  );
}

export default async function SettingsOverviewPage() {
  const { adminUser } = await requireRole("super_admin");
  const visits = await getSettingsPageVisits(adminUser.id);
  const frequent = topVisitedHrefs(visits, 4)
    .map((h) => SETTINGS_CATALOG.find((p) => p.href === h))
    .filter((p): p is SettingsPage => !!p);

  return (
    <>
      <SettingsPageHeader
        title="Settings"
        description="Manage your website, business and integrations — everything that shapes how Life-Therapy runs."
      />
      <div className="space-y-8">
        {frequent.length > 0 && (
          <section>
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Most used
            </h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {frequent.map((page) => (
                <SettingCard key={page.href} page={page} />
              ))}
            </div>
          </section>
        )}

        {SETTINGS_NAV_GROUPS.map((group) => {
          const items = SETTINGS_CATALOG.filter((p) => p.group === group);
          if (items.length === 0) return null;
          return (
            <section key={group}>
              <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {group}
              </h2>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {items.map((page) => (
                  <SettingCard key={page.href} page={page} />
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </>
  );
}
