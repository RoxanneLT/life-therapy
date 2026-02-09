export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { formatPrice } from "@/lib/utils";
import { getCurrency } from "@/lib/get-region";
import { getDigitalProductPrice } from "@/lib/pricing";
import { AddToCartButton } from "@/components/public/cart/add-to-cart-button";
import { ArrowLeft, FileDown, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const product = await prisma.digitalProduct.findUnique({ where: { slug } });
  if (!product) return {};
  return {
    title: product.title,
    description: product.description || undefined,
  };
}

export default async function ProductDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const currency = await getCurrency();

  const product = await prisma.digitalProduct.findUnique({
    where: { slug },
  });

  if (!product || !product.isPublished) notFound();

  const price = getDigitalProductPrice(product, currency);

  return (
    <div className="mx-auto max-w-4xl px-4 py-12">
      <Button variant="ghost" size="sm" asChild className="mb-6">
        <Link href="/products">
          <ArrowLeft className="mr-2 h-4 w-4" />
          All Products
        </Link>
      </Button>

      <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
        {/* Image */}
        <div>
          {product.imageUrl ? (
            <div className="relative aspect-square overflow-hidden rounded-lg">
              <Image
                src={product.imageUrl}
                alt={product.title}
                fill
                className="object-cover"
              />
            </div>
          ) : (
            <div className="flex aspect-square items-center justify-center rounded-lg bg-muted">
              <FileDown className="h-16 w-16 text-muted-foreground" />
            </div>
          )}
        </div>

        {/* Details */}
        <div className="space-y-6">
          <div>
            <h1 className="font-heading text-3xl font-bold">{product.title}</h1>
            {product.category && (
              <p className="mt-1 text-sm text-muted-foreground">
                {product.category}
              </p>
            )}
          </div>

          {product.description && (
            <p className="text-muted-foreground">{product.description}</p>
          )}

          {product.fileName && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <FileText className="h-4 w-4" />
              <span>{product.fileName}</span>
            </div>
          )}

          <div className="border-t pt-4">
            <p className="text-3xl font-bold text-brand-600">
              {formatPrice(price, currency)}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              Instant digital download after purchase
            </p>
          </div>

          <AddToCartButton
            digitalProductId={product.id}
            label="Add to Cart"
            size="lg"
            className="w-full"
          />
        </div>
      </div>
    </div>
  );
}
