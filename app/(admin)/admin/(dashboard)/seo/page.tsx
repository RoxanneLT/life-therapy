export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { SeoManager } from "@/components/admin/seo-manager";

export default async function SeoPage() {
  // The same roles as its save action and its menu entry (Content → SEO). Until 2026-10-09 the page
  // had no guard of its own and no link, so any admin role could read it by URL and nobody found it.
  await requireRole("super_admin", "editor");
  const pages = await prisma.pageSeo.findMany({
    orderBy: { route: "asc" },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">SEO Settings</h1>
        <p className="text-sm text-muted-foreground">
          Manage meta titles, descriptions, and OG images for each page.
        </p>
      </div>
      <SeoManager pages={pages} />
    </div>
  );
}
