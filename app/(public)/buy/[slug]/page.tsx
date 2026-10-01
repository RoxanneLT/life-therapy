export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { formatPrice } from "@/lib/utils";
import { getDigitalProductPrice } from "@/lib/pricing";
import { Card, CardContent } from "@/components/ui/card";
import { FileText } from "lucide-react";
import Image from "next/image";
import type { Metadata } from "next";
import { BuyForm } from "./buy-form";

// A landing page for ads and ManyChat, not a catalogue page: kept out of search so it never
// competes with /products/<slug>.
export const metadata: Metadata = {
  title: "Buy",
  robots: { index: false, follow: false },
};

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

export default async function BuyNowPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { slug } = await params;
  const sp = await searchParams;

  const product = await prisma.digitalProduct.findFirst({
    where: { slug, isPublished: true },
    select: {
      slug: true,
      title: true,
      description: true,
      imageUrl: true,
      priceCents: true,
      priceCentsUsd: true,
      priceCentsEur: true,
      priceCentsGbp: true,
    },
  });
  if (!product) notFound();

  // ZAR whichever domain this is opened on: buy-now charges through Paystack in ZAR only.
  const priceCents = getDigitalProductPrice(product, "ZAR");

  // ManyChat fills these from the subscriber, so the buyer usually just presses Pay.
  // `name` is the fallback for a flow that only has a full name.
  const fullName = first(sp.name).trim();
  const [nameFirst, ...nameRest] = fullName ? fullName.split(/\s+/) : [""];
  const prefill = {
    email: first(sp.email),
    firstName: first(sp.first_name) || nameFirst,
    lastName: first(sp.last_name) || nameRest.join(" "),
  };

  return (
    <section className="px-4 py-12">
      <div className="mx-auto max-w-md">
        <Card>
          <CardContent className="space-y-6 pt-6">
            <div className="flex gap-4">
              {product.imageUrl ? (
                <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-md">
                  <Image src={product.imageUrl} alt={product.title} fill className="object-cover" sizes="96px" />
                </div>
              ) : (
                <div className="flex h-24 w-24 shrink-0 items-center justify-center rounded-md bg-muted">
                  <FileText className="h-8 w-8 text-muted-foreground" />
                </div>
              )}
              <div>
                <h1 className="font-heading text-xl font-bold">{product.title}</h1>
                <p className="mt-1 text-lg font-semibold text-brand-600">
                  {priceCents === 0 ? "Free" : formatPrice(priceCents, "ZAR")}
                </p>
              </div>
            </div>
            {product.description && (
              <p className="line-clamp-4 text-sm text-muted-foreground">{product.description}</p>
            )}
            <BuyForm slug={product.slug} free={priceCents === 0} prefill={prefill} />
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
