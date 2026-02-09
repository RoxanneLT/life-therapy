import { requireRole } from "@/lib/auth";
import { DigitalProductForm } from "@/components/admin/digital-product-form";
import { createDigitalProduct } from "../actions";

export const dynamic = "force-dynamic";

export default async function NewDigitalProductPage() {
  await requireRole("super_admin");

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold">Create Digital Product</h1>
      <DigitalProductForm onSubmit={createDigitalProduct} />
    </div>
  );
}
