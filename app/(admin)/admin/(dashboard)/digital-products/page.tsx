import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatPrice } from "@/lib/utils";
import Link from "next/link";
import { Plus } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function AdminDigitalProductsPage() {
  await requireRole("super_admin");

  const products = await prisma.digitalProduct.findMany({
    orderBy: { sortOrder: "asc" },
  });

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Digital Products</h1>
        <Button asChild>
          <Link href="/admin/digital-products/new">
            <Plus className="mr-2 h-4 w-4" />
            Add Product
          </Link>
        </Button>
      </div>

      <div className="rounded-md border">
        <table className="w-full">
          <thead>
            <tr className="border-b bg-muted/50 text-left text-sm">
              <th className="p-3 font-medium">Title</th>
              <th className="p-3 font-medium">Price (ZAR)</th>
              <th className="p-3 font-medium">Category</th>
              <th className="p-3 font-medium">File</th>
              <th className="p-3 font-medium">Status</th>
              <th className="p-3 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {products.map((p) => (
              <tr key={p.id} className="border-b">
                <td className="p-3 font-medium">{p.title}</td>
                <td className="p-3">{formatPrice(p.priceCents)}</td>
                <td className="p-3">
                  {p.category ? (
                    <Badge variant="secondary" className="text-xs">
                      {p.category}
                    </Badge>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </td>
                <td className="p-3 text-sm text-muted-foreground">
                  {p.fileName || p.fileUrl.split("/").pop()}
                </td>
                <td className="p-3">
                  <Badge variant={p.isPublished ? "default" : "outline"}>
                    {p.isPublished ? "Published" : "Draft"}
                  </Badge>
                </td>
                <td className="p-3">
                  <Button variant="ghost" size="sm" asChild>
                    <Link href={`/admin/digital-products/${p.id}`}>Edit</Link>
                  </Button>
                </td>
              </tr>
            ))}
            {products.length === 0 && (
              <tr>
                <td colSpan={6} className="p-8 text-center text-muted-foreground">
                  No digital products yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
