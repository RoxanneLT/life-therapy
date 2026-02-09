"use client";

import { useState } from "react";
import { useCart } from "@/lib/cart-store";
import { useRouter } from "next/navigation";
import { formatPrice } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft,
  GraduationCap,
  FileDown,
  Sparkles,
  ShoppingCart,
  CheckCircle2,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";

interface SelectableItem {
  id: string;
  title: string;
  imageUrl: string | null;
  priceCents: number;
}

interface PackageBuilderProps {
  packageId: string;
  packageTitle: string;
  packageSlug: string;
  packagePriceCents: number;
  courseSlots: number;
  digitalProductSlots: number;
  credits: number;
  courses: SelectableItem[];
  digitalProducts: SelectableItem[];
  currency: string;
}

export function PackageBuilder({
  packageId,
  packageTitle,
  packageSlug,
  packagePriceCents,
  courseSlots,
  digitalProductSlots,
  credits,
  courses,
  digitalProducts,
  currency,
}: PackageBuilderProps) {
  const [selectedCourses, setSelectedCourses] = useState<string[]>([]);
  const [selectedProducts, setSelectedProducts] = useState<string[]>([]);
  const { addItem, items } = useCart();
  const router = useRouter();

  const isComplete =
    selectedCourses.length === courseSlots &&
    selectedProducts.length === digitalProductSlots;

  const alreadyInCart = items.some(
    (i) => i.hybridPackageId === packageId
  );

  function toggleCourse(id: string) {
    setSelectedCourses((prev) => {
      if (prev.includes(id)) return prev.filter((c) => c !== id);
      if (prev.length >= courseSlots) return prev;
      return [...prev, id];
    });
  }

  function toggleProduct(id: string) {
    setSelectedProducts((prev) => {
      if (prev.includes(id)) return prev.filter((p) => p !== id);
      if (prev.length >= digitalProductSlots) return prev;
      return [...prev, id];
    });
  }

  function handleAddToCart() {
    addItem({
      hybridPackageId: packageId,
      packageSelections: {
        courseIds: selectedCourses,
        digitalProductIds: selectedProducts,
      },
      isGift: false,
    });
    router.push("/cart");
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-12">
      <Button variant="ghost" size="sm" asChild className="mb-6">
        <Link href={`/packages/${packageSlug}`}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Package
        </Link>
      </Button>

      <div className="mb-8">
        <h1 className="font-heading text-2xl font-bold">
          Build Your {packageTitle}
        </h1>
        <p className="mt-1 text-muted-foreground">
          Select your items below then add to cart.
        </p>
      </div>

      <div className="grid gap-8 lg:grid-cols-3">
        {/* Selection area */}
        <div className="space-y-8 lg:col-span-2">
          {/* Course selection */}
          {courseSlots > 0 && (
            <div>
              <div className="mb-4 flex items-center gap-2">
                <GraduationCap className="h-5 w-5 text-brand-500" />
                <h2 className="font-heading text-lg font-semibold">
                  Choose {courseSlots} Course{courseSlots !== 1 && "s"}
                </h2>
                <Badge variant="outline" className="ml-auto">
                  {selectedCourses.length} / {courseSlots}
                </Badge>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {courses.map((course) => {
                  const selected = selectedCourses.includes(course.id);
                  const disabled =
                    !selected && selectedCourses.length >= courseSlots;
                  return (
                    <button
                      key={course.id}
                      type="button"
                      onClick={() => toggleCourse(course.id)}
                      disabled={disabled}
                      className={`relative flex items-center gap-3 rounded-lg border p-3 text-left transition-colors ${
                        selected
                          ? "border-brand-500 bg-brand-50 ring-1 ring-brand-500"
                          : disabled
                            ? "cursor-not-allowed opacity-50"
                            : "hover:border-brand-300 hover:bg-muted/50"
                      }`}
                    >
                      {course.imageUrl ? (
                        <div className="h-12 w-12 flex-shrink-0 overflow-hidden rounded">
                          <Image
                            src={course.imageUrl}
                            alt={course.title}
                            width={48}
                            height={48}
                            className="h-full w-full object-cover"
                          />
                        </div>
                      ) : (
                        <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded bg-muted">
                          <GraduationCap className="h-5 w-5 text-muted-foreground" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">
                          {course.title}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Value: {formatPrice(course.priceCents, currency)}
                        </p>
                      </div>
                      {selected && (
                        <CheckCircle2 className="h-5 w-5 flex-shrink-0 text-brand-500" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Digital product selection */}
          {digitalProductSlots > 0 && (
            <div>
              <div className="mb-4 flex items-center gap-2">
                <FileDown className="h-5 w-5 text-brand-500" />
                <h2 className="font-heading text-lg font-semibold">
                  Choose {digitalProductSlots} Digital Product
                  {digitalProductSlots !== 1 && "s"}
                </h2>
                <Badge variant="outline" className="ml-auto">
                  {selectedProducts.length} / {digitalProductSlots}
                </Badge>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {digitalProducts.map((product) => {
                  const selected = selectedProducts.includes(product.id);
                  const disabled =
                    !selected &&
                    selectedProducts.length >= digitalProductSlots;
                  return (
                    <button
                      key={product.id}
                      type="button"
                      onClick={() => toggleProduct(product.id)}
                      disabled={disabled}
                      className={`relative flex items-center gap-3 rounded-lg border p-3 text-left transition-colors ${
                        selected
                          ? "border-brand-500 bg-brand-50 ring-1 ring-brand-500"
                          : disabled
                            ? "cursor-not-allowed opacity-50"
                            : "hover:border-brand-300 hover:bg-muted/50"
                      }`}
                    >
                      {product.imageUrl ? (
                        <div className="h-12 w-12 flex-shrink-0 overflow-hidden rounded">
                          <Image
                            src={product.imageUrl}
                            alt={product.title}
                            width={48}
                            height={48}
                            className="h-full w-full object-cover"
                          />
                        </div>
                      ) : (
                        <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded bg-muted">
                          <FileDown className="h-5 w-5 text-muted-foreground" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">
                          {product.title}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Value: {formatPrice(product.priceCents, currency)}
                        </p>
                      </div>
                      {selected && (
                        <CheckCircle2 className="h-5 w-5 flex-shrink-0 text-brand-500" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Summary sidebar */}
        <div>
          <Card className="sticky top-24">
            <CardContent className="space-y-4 pt-6">
              <h2 className="font-heading text-lg font-semibold">
                {packageTitle}
              </h2>

              <div className="space-y-2 text-sm">
                {courseSlots > 0 && (
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Courses</span>
                    <span
                      className={
                        selectedCourses.length === courseSlots
                          ? "text-green-600"
                          : ""
                      }
                    >
                      {selectedCourses.length} / {courseSlots}
                    </span>
                  </div>
                )}
                {digitalProductSlots > 0 && (
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">
                      Digital Products
                    </span>
                    <span
                      className={
                        selectedProducts.length === digitalProductSlots
                          ? "text-green-600"
                          : ""
                      }
                    >
                      {selectedProducts.length} / {digitalProductSlots}
                    </span>
                  </div>
                )}
                {credits > 0 && (
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">
                      Session Credits
                    </span>
                    <div className="flex items-center gap-1">
                      <Sparkles className="h-3.5 w-3.5 text-brand-500" />
                      <span>{credits} included</span>
                    </div>
                  </div>
                )}
              </div>

              <div className="border-t pt-4">
                <div className="flex items-center justify-between">
                  <span className="font-semibold">Package Price</span>
                  <span className="text-xl font-bold text-brand-600">
                    {formatPrice(packagePriceCents, currency)}
                  </span>
                </div>
              </div>

              {alreadyInCart ? (
                <Button className="w-full" variant="secondary" disabled>
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                  Already in Cart
                </Button>
              ) : (
                <Button
                  className="w-full gap-2"
                  size="lg"
                  disabled={!isComplete}
                  onClick={handleAddToCart}
                >
                  <ShoppingCart className="h-4 w-4" />
                  Add to Cart
                </Button>
              )}

              {!isComplete && !alreadyInCart && (
                <p className="text-center text-xs text-muted-foreground">
                  Select all items to continue
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
