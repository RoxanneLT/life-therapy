import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
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
  await requireRole("super_admin");
  const { id } = await params;

  const product = await prisma.digitalProduct.findUnique({
    where: { id },
  });

  if (!product) notFound();

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
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Edit Digital Product</h1>
        <form action={handleDelete}>
          <Button variant="destructive" size="sm" type="submit">
            Delete Product
          </Button>
        </form>
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
        onSubmit={handleUpdate}
      />
    </div>
  );
}
