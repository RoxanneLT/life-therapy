import { requireRole } from "@/lib/auth";
import { PageHeader } from "@/components/admin/page-header";
import { prisma } from "@/lib/prisma";
import { DigitalProductForm } from "@/components/admin/digital-product-form";
import { createDigitalProduct } from "../actions";

export const dynamic = "force-dynamic";

export default async function NewDigitalProductPage() {
  await requireRole("super_admin");

  const products = await prisma.digitalProduct.findMany({
    where: { category: { not: null } },
    select: { category: true },
    distinct: ["category"],
    orderBy: { category: "asc" },
  });
  const categories = products
    .map((p) => p.category)
    .filter((c): c is string => Boolean(c));

  return (
    <div>
      <div className="mb-6">
        <PageHeader title="Create Digital Product" back={{ href: "/admin/digital-products", to: "Digital Products" }} />
      </div>
      <DigitalProductForm categories={categories} onSubmit={createDigitalProduct} />
    </div>
  );
}
