export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Plus, Package } from "lucide-react";
import { SortablePackageList } from "./sortable-package-list";
import { PackageCategoryManager } from "./category-manager";
import { PageHeader } from "@/components/admin/page-header";
import { EmptyState } from "@/components/admin/empty-state";

export default async function AdminPackagesPage() {
  await requireRole("super_admin");

  const packages = await prisma.hybridPackage.findMany({
    orderBy: { sortOrder: "asc" },
    select: {
      id: true,
      title: true,
      priceCents: true,
      credits: true,
      courseSlots: true,
      digitalProductSlots: true,
      category: true,
      isPublished: true,
    },
  });

  const categoryCounts = new Map<string, number>();
  for (const p of packages) {
    if (p.category) {
      categoryCounts.set(p.category, (categoryCounts.get(p.category) ?? 0) + 1);
    }
  }
  const categories = Array.from(categoryCounts.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Packages"
        description="Pick-your-own bundles with courses, digital products & session credits."
        action={
          <Button asChild>
            <Link href="/admin/packages/new">
              <Plus className="mr-2 h-4 w-4" />
              Add Package
            </Link>
          </Button>
        }
      />

      <PackageCategoryManager categories={categories} />

      {packages.length > 0 ? (
        <SortablePackageList packages={packages} />
      ) : (
        <EmptyState
          icon={Package}
          message="No packages created yet."
          action={
            <Button asChild>
              <Link href="/admin/packages/new">Create your first package</Link>
            </Button>
          }
        />
      )}
    </div>
  );
}
