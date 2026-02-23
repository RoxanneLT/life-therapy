export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { SeoManager } from "@/components/admin/seo-manager";

export default async function SeoPage() {
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
