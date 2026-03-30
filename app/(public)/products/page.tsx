export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { formatPrice } from "@/lib/utils";
import { getCurrency } from "@/lib/get-region";
import { getDigitalProductPrice } from "@/lib/pricing";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AddToCartButton } from "@/components/public/cart/add-to-cart-button";
import { FileDown, BookOpen, ArrowRight } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import { buildStaticPageMetadata } from "@/lib/metadata";
import { breadcrumbJsonLd, JsonLdScript } from "@/lib/json-ld";

export async function generateMetadata(): Promise<Metadata> {
  return buildStaticPageMetadata(
    "/products",
    "Digital Products",
    "Downloadable journals, planners, workbooks, and toolkits designed by a qualified life coach to support your personal growth journey.",
    "/images/hero-home.jpg"
  );
}

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string }>;
}) {
  const params = await searchParams;
  const activeCategory = params.category || "all";

  const products = await prisma.digitalProduct.findMany({
    where: { isPublished: true },
    orderBy: { sortOrder: "asc" },
  });

  const currency = await getCurrency();

  // Extract unique categories
  const categories = Array.from(
    new Set(products.map((p) => p.category).filter(Boolean))
  ).sort() as string[];

  // Filter products
  const filtered =
    activeCategory === "all"
      ? products
      : products.filter(
          (p) => p.category?.toLowerCase() === activeCategory.toLowerCase()
        );

  const breadcrumbLd = await breadcrumbJsonLd([
    { name: "Home", href: "/" },
    { name: "Digital Products", href: "/products" },
  ]);

  return (
    <>
      <JsonLdScript data={[breadcrumbLd]} />

      {/* Hero */}
      <section className="bg-gradient-to-br from-brand-50 via-cream-50 to-brand-100 px-4 py-16 sm:py-24">
        <div className="mx-auto max-w-4xl text-center">
          <p className="mb-3 text-sm font-semibold uppercase tracking-wider text-brand-500">
            Digital Resources
          </p>
          <h1 className="font-heading text-3xl font-bold uppercase tracking-wide text-foreground sm:text-4xl lg:text-5xl">
            Tools for Your Growth Journey
          </h1>
          <div className="mx-auto mt-3 h-[3px] w-16 bg-terracotta-500" />
          <p className="mx-auto mt-5 max-w-2xl text-lg text-muted-foreground">
            Beautifully designed journals, planners, workbooks, and toolkits — created by a qualified life coach to help you build confidence, set boundaries, and create meaningful change.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
            <Button size="lg" asChild>
              <a href="#products">
                <BookOpen className="mr-2 h-4 w-4" />
                Browse Products
              </a>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <Link href="/courses">
                Explore Courses
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>
          <p className="mt-4 text-xs text-muted-foreground">
            {products.length} products available &middot; Instant digital download &middot; Multi-currency pricing
          </p>
        </div>
      </section>

      {/* Category filter + Products grid */}
      <section id="products" className="mx-auto max-w-6xl px-4 py-12">
        {/* Category tabs */}
        {categories.length > 1 && (
          <div className="mb-8 flex flex-wrap items-center justify-center gap-2">
            <Link
              href="/products"
              className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                activeCategory === "all"
                  ? "bg-brand-500 text-white"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              }`}
            >
              All ({products.length})
            </Link>
            {categories.map((cat) => {
              const count = products.filter(
                (p) => p.category?.toLowerCase() === cat.toLowerCase()
              ).length;
              return (
                <Link
                  key={cat}
                  href={`/products?category=${encodeURIComponent(cat.toLowerCase())}`}
                  className={`rounded-full px-4 py-1.5 text-sm font-medium capitalize transition-colors ${
                    activeCategory.toLowerCase() === cat.toLowerCase()
                      ? "bg-brand-500 text-white"
                      : "bg-muted text-muted-foreground hover:bg-muted/80"
                  }`}
                >
                  {cat} ({count})
                </Link>
              );
            })}
          </div>
        )}

        {/* Results count */}
        <p className="mb-6 text-sm text-muted-foreground">
          Showing {filtered.length} {filtered.length === 1 ? "product" : "products"}
          {activeCategory !== "all" && (
            <>
              {" "}in <span className="capitalize font-medium text-foreground">{activeCategory}</span>
            </>
          )}
        </p>

        {filtered.length === 0 ? (
          <div className="py-16 text-center text-muted-foreground">
            <FileDown className="mx-auto mb-4 h-12 w-12" />
            <p className="text-lg font-medium">No products in this category yet.</p>
            <p className="mt-2">Check back soon or browse all products.</p>
            <Button variant="outline" className="mt-4" asChild>
              <Link href="/products">View All Products</Link>
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((product) => {
              const price = getDigitalProductPrice(product, currency);
              return (
                <Card key={product.id} className="group overflow-hidden transition-shadow hover:shadow-lg">
                  <Link href={`/products/${product.slug}`}>
                    {product.imageUrl ? (
                      <div className="relative aspect-[4/3] overflow-hidden">
                        <Image
                          src={product.imageUrl}
                          alt={product.title}
                          fill
                          className="object-cover transition-transform duration-300 group-hover:scale-105"
                          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                        />
                        {product.category && (
                          <Badge className="absolute left-3 top-3 bg-brand-500/90 text-white capitalize">
                            {product.category}
                          </Badge>
                        )}
                      </div>
                    ) : (
                      <div className="relative flex aspect-[4/3] items-center justify-center bg-gradient-to-br from-brand-50 to-brand-100">
                        <FileDown className="h-12 w-12 text-brand-300" />
                        {product.category && (
                          <Badge className="absolute left-3 top-3 bg-brand-500/90 text-white capitalize">
                            {product.category}
                          </Badge>
                        )}
                      </div>
                    )}
                  </Link>
                  <CardContent className="pt-4">
                    <Link href={`/products/${product.slug}`}>
                      <h3 className="font-heading text-lg font-semibold leading-snug transition-colors group-hover:text-brand-600">
                        {product.title}
                      </h3>
                    </Link>
                    {product.description && (
                      <p className="mt-1.5 line-clamp-2 text-sm text-muted-foreground">
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
                        label="Add"
                      />
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </section>

      {/* Bottom CTA */}
      <section className="bg-gradient-to-r from-brand-500 to-brand-600 px-4 py-12">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="font-heading text-2xl font-bold text-white sm:text-3xl">
            Looking for Something More Structured?
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-white/80">
            Our self-paced courses combine video lessons, exercises, and practical tools — with full lifetime access.
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-4">
            <Button
              size="lg"
              className="bg-white text-brand-700 hover:bg-white/90"
              asChild
            >
              <Link href="/courses">Browse Courses</Link>
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="border-white/60 bg-transparent text-white hover:bg-white/10"
              asChild
            >
              <Link href="/packages">View Bundles</Link>
            </Button>
          </div>
        </div>
      </section>
    </>
  );
}
