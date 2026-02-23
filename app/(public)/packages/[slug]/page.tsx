export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { formatPrice } from "@/lib/utils";
import { getCurrency } from "@/lib/get-region";
import { getPackagePrice } from "@/lib/pricing";
import { Button } from "@/components/ui/button";
import { ArrowLeft, GraduationCap, FileDown, Sparkles, Package } from "lucide-react";
import Link from "next/link";
import type { Metadata } from "next";
import { buildMetadata } from "@/lib/metadata";
import { breadcrumbJsonLd, JsonLdScript } from "@/lib/json-ld";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const pkg = await prisma.hybridPackage.findUnique({ where: { slug } });
  if (!pkg) return {};
  return buildMetadata({
    title: pkg.metaTitle || pkg.title,
    description: pkg.metaDescription || pkg.description,
    ogImageUrl: pkg.imageUrl,
    route: `/packages/${slug}`,
  });
}

export default async function PackageDetailPage({
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

  const price = getPackagePrice(pkg, currency);

  const breadcrumbLd = await breadcrumbJsonLd([
    { name: "Home", href: "/" },
    { name: "Packages", href: "/packages" },
    { name: pkg.title, href: `/packages/${pkg.slug}` },
  ]);

  return (
    <>
    <JsonLdScript data={breadcrumbLd} />
    <div className="mx-auto max-w-3xl px-4 py-12">
      <Button variant="ghost" size="sm" asChild className="mb-6">
        <Link href="/packages">
          <ArrowLeft className="mr-2 h-4 w-4" />
          All Packages
        </Link>
      </Button>

      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Package className="h-8 w-8 text-brand-500" />
          <h1 className="font-heading text-3xl font-bold">{pkg.title}</h1>
        </div>

        {pkg.description && (
          <p className="text-lg text-muted-foreground">{pkg.description}</p>
        )}

        <div className="rounded-lg border p-6 space-y-4">
          <h2 className="font-heading text-lg font-semibold">What&apos;s Included</h2>
          <div className="space-y-3">
            {pkg.courseSlots > 0 && (
              <div className="flex items-center gap-3">
                <GraduationCap className="h-5 w-5 text-brand-500" />
                <span>
                  Choose {pkg.courseSlots} course{pkg.courseSlots !== 1 && "s"} from our full catalog
                </span>
              </div>
            )}
            {pkg.digitalProductSlots > 0 && (
              <div className="flex items-center gap-3">
                <FileDown className="h-5 w-5 text-brand-500" />
                <span>
                  Choose {pkg.digitalProductSlots} digital product
                  {pkg.digitalProductSlots !== 1 && "s"}
                </span>
              </div>
            )}
            {pkg.credits > 0 && (
              <div className="flex items-center gap-3">
                <Sparkles className="h-5 w-5 text-brand-500" />
                <span>
                  {pkg.credits} session credit{pkg.credits !== 1 && "s"} included
                </span>
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between rounded-lg border p-6">
          <p className="text-3xl font-bold text-brand-600">
            {formatPrice(price, currency)}
          </p>
          <Button size="lg" asChild>
            <Link href={`/packages/${pkg.slug}/build`}>
              Build Your Package
            </Link>
          </Button>
        </div>
      </div>
    </div>
    </>
  );
}
