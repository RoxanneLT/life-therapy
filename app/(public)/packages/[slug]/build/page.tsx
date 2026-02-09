export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { getCurrency } from "@/lib/get-region";
import { getCoursePrice, getDigitalProductPrice, getPackagePrice } from "@/lib/pricing";
import { PackageBuilder } from "./package-builder";
import type { Metadata } from "next";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const pkg = await prisma.hybridPackage.findUnique({ where: { slug } });
  if (!pkg) return {};
  return { title: `Build Your ${pkg.title}` };
}

export default async function PackageBuildPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const currency = await getCurrency();

  const pkg = await prisma.hybridPackage.findUnique({
    where: { slug },
  });

  if (!pkg || !pkg.isPublished) notFound();

  // Fetch available items for selection
  const [courses, digitalProducts] = await Promise.all([
    pkg.courseSlots > 0
      ? prisma.course.findMany({
          where: { isPublished: true },
          select: {
            id: true,
            title: true,
            slug: true,
            imageUrl: true,
            price: true,
            priceUsd: true,
            priceEur: true,
            priceGbp: true,
          },
          orderBy: { sortOrder: "asc" },
        })
      : [],
    pkg.digitalProductSlots > 0
      ? prisma.digitalProduct.findMany({
          where: { isPublished: true },
          select: {
            id: true,
            title: true,
            slug: true,
            imageUrl: true,
            priceCents: true,
            priceCentsUsd: true,
            priceCentsEur: true,
            priceCentsGbp: true,
          },
          orderBy: { sortOrder: "asc" },
        })
      : [],
  ]);

  // Map to client-safe format with prices
  const courseOptions = courses.map((c) => ({
    id: c.id,
    title: c.title,
    imageUrl: c.imageUrl,
    priceCents: getCoursePrice(c, currency),
  }));

  const productOptions = digitalProducts.map((d) => ({
    id: d.id,
    title: d.title,
    imageUrl: d.imageUrl,
    priceCents: getDigitalProductPrice(d, currency),
  }));

  return (
    <PackageBuilder
      packageId={pkg.id}
      packageTitle={pkg.title}
      packageSlug={pkg.slug}
      packagePriceCents={getPackagePrice(pkg, currency)}
      courseSlots={pkg.courseSlots}
      digitalProductSlots={pkg.digitalProductSlots}
      credits={pkg.credits}
      courses={courseOptions}
      digitalProducts={productOptions}
      currency={currency}
    />
  );
}
