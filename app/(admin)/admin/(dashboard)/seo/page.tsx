export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { requireAccess } from "@/lib/auth";
import { PageHeader } from "@/components/admin/page-header";
import { SeoManager } from "@/components/admin/seo-manager";

export default async function SeoPage() {
  // The same roles as its save action and its menu entry (Content → SEO). Until 2026-10-09 the page
  // had no guard of its own and no link, so any admin role could read it by URL and nobody found it.
  await requireAccess("/admin/seo");
  const pages = await prisma.pageSeo.findMany({
    orderBy: { route: "asc" },
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="SEO Settings"
        description="Manage meta titles, descriptions, and OG images for each page."
      />
      <SeoManager pages={pages} />
    </div>
  );
}
