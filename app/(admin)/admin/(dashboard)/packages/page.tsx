export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Plus, Package } from "lucide-react";
import { SortablePackageList } from "./sortable-package-list";

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
      isPublished: true,
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold">Packages</h1>
          <p className="text-sm text-muted-foreground">
            Pick-your-own bundles with courses, digital products & session credits.
          </p>
        </div>
        <Button asChild>
          <Link href="/admin/packages/new">
            <Plus className="mr-2 h-4 w-4" />
            Add Package
          </Link>
        </Button>
      </div>

      {packages.length > 0 ? (
        <SortablePackageList packages={packages} />
      ) : (
        <div className="flex flex-col items-center py-12 text-center">
          <Package className="mb-4 h-12 w-12 text-muted-foreground" />
          <p className="text-muted-foreground">No packages created yet.</p>
          <Button className="mt-4" asChild>
            <Link href="/admin/packages/new">Create your first package</Link>
          </Button>
        </div>
      )}
    </div>
  );
}
