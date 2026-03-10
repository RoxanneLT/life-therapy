import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Plus } from "lucide-react";
import { SortableProductList } from "./sortable-product-list";
import { CategoryManager } from "./category-manager";
import { PageHeader } from "@/components/admin/page-header";

export const dynamic = "force-dynamic";

export default async function AdminDigitalProductsPage() {
  await requireRole("super_admin");

  const products = await prisma.digitalProduct.findMany({
    orderBy: { sortOrder: "asc" },
    select: {
      id: true,
      title: true,
      priceCents: true,
      category: true,
      fileName: true,
      fileUrl: true,
      isPublished: true,
    },
  });

  // Build category counts for the manager
  const categoryCounts = new Map<string, number>();
  for (const p of products) {
    if (p.category) {
      categoryCounts.set(p.category, (categoryCounts.get(p.category) ?? 0) + 1);
    }
  }
  const categories = Array.from(categoryCounts.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div>
      <PageHeader
        title="Digital Products"
        action={
          <Button asChild>
            <Link href="/admin/digital-products/new">
              <Plus className="mr-2 h-4 w-4" />
              Add Product
            </Link>
          </Button>
        }
      />

      <CategoryManager categories={categories} />
      <SortableProductList products={products} />
    </div>
  );
}
