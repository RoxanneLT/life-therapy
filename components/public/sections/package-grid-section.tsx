import type { PageSection } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { formatPrice } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Package } from "lucide-react";
import Link from "next/link";
import { AddToCartButton } from "@/components/public/cart/add-to-cart-button";

interface PackageGridSectionProps {
  section: PageSection;
}

export async function PackageGridSection({ section }: PackageGridSectionProps) {
  const packages = await prisma.hybridPackage.findMany({
    where: { isPublished: true },
    include: {
      courses: {
        include: { course: true },
        orderBy: { sortOrder: "asc" },
      },
    },
    orderBy: { sortOrder: "asc" },
  });

  const packagesWithSavings = packages.map((pkg) => {
    const individualTotal = pkg.courses.reduce(
      (sum, pc) => sum + pc.course.price,
      0
    );
    const savings = individualTotal > 0 ? individualTotal - pkg.priceCents : 0;
    return { ...pkg, individualTotal, savings };
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

        {packages.length === 0 ? (
          <div className="py-16 text-center text-muted-foreground">
            Packages coming soon.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
            {packagesWithSavings.map((pkg) => (
              <Card key={pkg.id} className="overflow-hidden">
                <CardContent className="pt-6">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <Package className="h-5 w-5 text-brand-500" />
                        <h3 className="font-heading text-xl font-semibold">
                          {pkg.title}
                        </h3>
                      </div>
                      {pkg.credits > 0 && (
                        <p className="mt-1 text-sm text-muted-foreground">
                          Includes {pkg.credits} session credit{pkg.credits !== 1 && "s"}
                        </p>
                      )}
                    </div>
                    {pkg.savings > 0 && (
                      <Badge className="bg-terracotta-500 text-white">
                        Save {formatPrice(pkg.savings)}
                      </Badge>
                    )}
                  </div>

                  {pkg.description && (
                    <p className="mt-3 text-sm text-muted-foreground">
                      {pkg.description}
                    </p>
                  )}

                  {pkg.courses.length > 0 && (
                    <div className="mt-4 space-y-2">
                      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        Includes {pkg.courses.length} course{pkg.courses.length !== 1 && "s"}:
                      </p>
                      {pkg.courses.map((pc) => (
                        <div
                          key={pc.id}
                          className="flex items-center gap-2 text-sm"
                        >
                          <CheckCircle2 className="h-4 w-4 flex-shrink-0 text-brand-500" />
                          <Link
                            href={`/courses/${pc.course.slug}`}
                            className="hover:text-brand-600 hover:underline"
                          >
                            {pc.course.title}
                          </Link>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="mt-6 flex items-end justify-between border-t pt-4">
                    <div>
                      {pkg.savings > 0 && (
                        <p className="text-sm text-muted-foreground line-through">
                          {formatPrice(pkg.individualTotal)}
                        </p>
                      )}
                      <p className="text-2xl font-bold text-brand-600">
                        {formatPrice(pkg.priceCents)}
                      </p>
                    </div>
                    <AddToCartButton
                      hybridPackageId={pkg.id}
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
