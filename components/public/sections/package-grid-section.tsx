import type { PageSection } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { formatPrice } from "@/lib/utils";
import { getCurrency } from "@/lib/get-region";
import { getPackagePrice } from "@/lib/pricing";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { GraduationCap, FileDown, Sparkles, Package } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

interface PackageGridSectionProps {
  section: PageSection;
}

export async function PackageGridSection({ section }: PackageGridSectionProps) {
  const packages = await prisma.hybridPackage.findMany({
    where: { isPublished: true },
    orderBy: { sortOrder: "asc" },
  });

  const currency = getCurrency();

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
            {packages.map((pkg) => {
              const pkgPrice = getPackagePrice(pkg, currency);
              return (
                <Card key={pkg.id} className="overflow-hidden">
                  <CardContent className="pt-6">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        <Package className="h-5 w-5 text-brand-500" />
                        <h3 className="font-heading text-xl font-semibold">
                          {pkg.title}
                        </h3>
                      </div>
                      <Badge className="bg-brand-100 text-brand-700">
                        Pick Your Own
                      </Badge>
                    </div>

                    {pkg.description && (
                      <p className="mt-3 text-sm text-muted-foreground">
                        {pkg.description}
                      </p>
                    )}

                    <div className="mt-4 space-y-2">
                      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        Bundle includes:
                      </p>
                      {pkg.courseSlots > 0 && (
                        <div className="flex items-center gap-2 text-sm">
                          <GraduationCap className="h-4 w-4 flex-shrink-0 text-brand-500" />
                          <span>
                            Choose {pkg.courseSlots} course
                            {pkg.courseSlots !== 1 && "s"}
                          </span>
                        </div>
                      )}
                      {pkg.digitalProductSlots > 0 && (
                        <div className="flex items-center gap-2 text-sm">
                          <FileDown className="h-4 w-4 flex-shrink-0 text-brand-500" />
                          <span>
                            Choose {pkg.digitalProductSlots} digital product
                            {pkg.digitalProductSlots !== 1 && "s"}
                          </span>
                        </div>
                      )}
                      {pkg.credits > 0 && (
                        <div className="flex items-center gap-2 text-sm">
                          <Sparkles className="h-4 w-4 flex-shrink-0 text-brand-500" />
                          <span>
                            {pkg.credits} session credit
                            {pkg.credits !== 1 && "s"}
                          </span>
                        </div>
                      )}
                    </div>

                    <div className="mt-6 flex items-end justify-between border-t pt-4">
                      <p className="text-2xl font-bold text-brand-600">
                        {formatPrice(pkgPrice, currency)}
                      </p>
                      <Button asChild>
                        <Link href={`/packages/${pkg.slug}/build`}>
                          Build Your Package
                        </Link>
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
