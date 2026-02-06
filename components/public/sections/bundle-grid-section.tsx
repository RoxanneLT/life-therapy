import type { PageSection } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { formatPrice } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Package } from "lucide-react";
import Link from "next/link";
import { AddToCartButton } from "@/components/public/cart/add-to-cart-button";

interface BundleGridSectionProps {
  section: PageSection;
}

export async function BundleGridSection({ section }: BundleGridSectionProps) {
  const bundles = await prisma.bundle.findMany({
    where: { isPublished: true },
    include: {
      bundleCourses: {
        include: { course: true },
        orderBy: { sortOrder: "asc" },
      },
    },
    orderBy: { sortOrder: "asc" },
  });

  const bundlesWithSavings = bundles.map((bundle) => {
    const individualTotal = bundle.bundleCourses.reduce(
      (sum, bc) => sum + bc.course.price,
      0
    );
    const savings = individualTotal - bundle.price;
    return { ...bundle, individualTotal, savings };
  });

  return (
    <section className="px-4 py-12">
      <div className="mx-auto max-w-6xl">
        {section.title && (
          <div className="mb-2 text-center">
            <h2 className="font-heading text-3xl font-bold uppercase tracking-wide text-brand-700">
              {section.title}
            </h2>
            <div className="mx-auto mt-3 h-[3px] w-16 bg-terracotta-500" />
          </div>
        )}
        {section.subtitle && (
          <p className="mb-8 text-center text-muted-foreground">
            {section.subtitle}
          </p>
        )}

        {bundles.length === 0 ? (
          <div className="py-16 text-center text-muted-foreground">
            Bundles coming soon.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
            {bundlesWithSavings.map((bundle) => (
              <Card key={bundle.id} className="overflow-hidden">
                <CardContent className="pt-6">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <Package className="h-5 w-5 text-brand-500" />
                        <h3 className="font-heading text-xl font-semibold">
                          {bundle.title}
                        </h3>
                      </div>
                      {bundle.bestFor && (
                        <p className="mt-1 text-sm text-muted-foreground">
                          Best for: {bundle.bestFor}
                        </p>
                      )}
                    </div>
                    {bundle.savings > 0 && (
                      <Badge className="bg-terracotta-500 text-white">
                        Save {formatPrice(bundle.savings)}
                      </Badge>
                    )}
                  </div>

                  {bundle.description && (
                    <p className="mt-3 text-sm text-muted-foreground">
                      {bundle.description}
                    </p>
                  )}

                  <div className="mt-4 space-y-2">
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Includes {bundle.bundleCourses.length} courses:
                    </p>
                    {bundle.bundleCourses.map((bc) => (
                      <div
                        key={bc.id}
                        className="flex items-center gap-2 text-sm"
                      >
                        <CheckCircle2 className="h-4 w-4 flex-shrink-0 text-brand-500" />
                        <Link
                          href={`/courses/${bc.course.slug}`}
                          className="hover:text-brand-600 hover:underline"
                        >
                          {bc.course.title}
                        </Link>
                      </div>
                    ))}
                  </div>

                  <div className="mt-6 flex items-end justify-between border-t pt-4">
                    <div>
                      {bundle.savings > 0 && (
                        <p className="text-sm text-muted-foreground line-through">
                          {formatPrice(bundle.individualTotal)}
                        </p>
                      )}
                      <p className="text-2xl font-bold text-brand-600">
                        {formatPrice(bundle.price)}
                      </p>
                    </div>
                    <AddToCartButton
                      bundleId={bundle.id}
                      label="Add to Cart"
                    />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
