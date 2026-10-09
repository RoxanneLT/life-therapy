import { prisma } from "@/lib/prisma";
import { requireAccess } from "@/lib/auth";
import { PageHeader } from "@/components/admin/page-header";
import { notFound } from "next/navigation";
import { DigitalProductForm } from "@/components/admin/digital-product-form";
import { updateDigitalProduct, deleteDigitalProduct } from "../actions";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

export default async function EditDigitalProductPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAccess("/admin/digital-products");
  const { id } = await params;

  const [product, allProducts] = await Promise.all([
    prisma.digitalProduct.findUnique({ where: { id } }),
    prisma.digitalProduct.findMany({
      where: { category: { not: null } },
      select: { category: true },
      distinct: ["category"],
      orderBy: { category: "asc" },
    }),
  ]);

  if (!product) notFound();

  const categories = allProducts
    .map((p) => p.category)
    .filter((c): c is string => Boolean(c));

  async function handleUpdate(formData: FormData) {
    "use server";
    await updateDigitalProduct(id, formData);
  }

  async function handleDelete() {
    "use server";
    await deleteDigitalProduct(id);
  }

  return (
    <div>
      <div className="mb-6">
        <PageHeader
          title="Edit Digital Product"
          back={{ href: "/admin/digital-products", to: "Digital Products" }}
          action={
            <form action={handleDelete}>
              <Button variant="destructive" size="sm" type="submit">
                Delete Product
              </Button>
            </form>
          }
        />
      </div>
      <DigitalProductForm
        initialData={{
          ...product,
          description: product.description,
          imageUrl: product.imageUrl,
          fileName: product.fileName,
          fileSizeBytes: product.fileSizeBytes,
          priceCentsUsd: product.priceCentsUsd,
          priceCentsEur: product.priceCentsEur,
          priceCentsGbp: product.priceCentsGbp,
          category: product.category,
        }}
        categories={categories}
        onSubmit={handleUpdate}
      />
    </div>
  );
}
