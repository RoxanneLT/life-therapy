export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { formatPrice } from "@/lib/utils";
import { getCurrency } from "@/lib/get-region";
import { getDigitalProductPrice } from "@/lib/pricing";
import { Card, CardContent } from "@/components/ui/card";
import { AddToCartButton } from "@/components/public/cart/add-to-cart-button";
import { FileDown } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import { buildStaticPageMetadata } from "@/lib/metadata";

export async function generateMetadata(): Promise<Metadata> {
  return buildStaticPageMetadata(
    "/products",
    "Digital Products",
    "Downloadable workbooks, toolkits, and guides to support your personal growth journey.",
    "/images/hero-home.jpg"
  );
}

export default async function ProductsPage() {
  const products = await prisma.digitalProduct.findMany({
    where: { isPublished: true },
    orderBy: { sortOrder: "asc" },
  });

  const currency = await getCurrency();

  return (
    <div className="mx-auto max-w-6xl px-4 py-12">
      <div className="mb-8 text-center">
        <h1 className="font-heading text-3xl font-bold uppercase tracking-wide text-brand-700">
          Digital Products
        </h1>
        <div className="mx-auto mt-3 h-[3px] w-16 bg-terracotta-500" />
        <p className="mt-4 text-muted-foreground">
          Downloadable workbooks, toolkits, and guides to support your journey.
        </p>
      </div>

      {products.length === 0 ? (
        <div className="py-16 text-center text-muted-foreground">
          Digital products coming soon.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {products.map((product) => {
            const price = getDigitalProductPrice(product, currency);
            return (
              <Card key={product.id} className="overflow-hidden">
                <Link href={`/products/${product.slug}`}>
                  {product.imageUrl ? (
                    <div className="relative aspect-[4/3]">
                      <Image
                        src={product.imageUrl}
                        alt={product.title}
                        fill
                        className="object-cover"
                      />
                    </div>
                  ) : (
                    <div className="flex aspect-[4/3] items-center justify-center bg-muted">
                      <FileDown className="h-12 w-12 text-muted-foreground" />
                    </div>
                  )}
                </Link>
                <CardContent className="pt-4">
                  <Link href={`/products/${product.slug}`}>
                    <h3 className="font-heading text-lg font-semibold hover:text-brand-600">
                      {product.title}
                    </h3>
                  </Link>
                  {product.description && (
                    <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                      {product.description}
                    </p>
                  )}
                  <div className="mt-4 flex items-center justify-between">
                    <p className="text-lg font-bold text-brand-600">
                      {formatPrice(price, currency)}
                    </p>
                    <AddToCartButton
                      digitalProductId={product.id}
                      size="sm"
                      label="Add to Cart"
                    />
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
