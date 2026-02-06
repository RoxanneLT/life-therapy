export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { notFound } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Link from "next/link";
import { ArrowLeft, Trash2 } from "lucide-react";
import { updateCouponAction, deleteCouponAction } from "../actions";
import { format } from "date-fns";

export default async function EditCouponPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await requireRole("super_admin");

  const coupon = await prisma.coupon.findUnique({ where: { id } });
  if (!coupon) notFound();

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/admin/coupons">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Link>
        </Button>
        <h1 className="font-heading text-2xl font-bold">Edit Coupon</h1>
      </div>

      <Card className="mx-auto max-w-lg">
        <CardHeader>
          <CardTitle className="text-base">
            Coupon: {coupon.code}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form action={updateCouponAction} className="space-y-4">
            <input type="hidden" name="id" value={coupon.id} />

            <div>
              <Label htmlFor="code">Code</Label>
              <Input
                id="code"
                name="code"
                defaultValue={coupon.code}
                required
                className="mt-1 uppercase"
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="type">Type</Label>
                <select
                  id="type"
                  name="type"
                  defaultValue={coupon.type}
                  className="mt-1 block w-full rounded-md border px-3 py-2 text-sm"
                  required
                >
                  <option value="percentage">Percentage</option>
                  <option value="fixed_amount">Fixed Amount (cents)</option>
                </select>
              </div>
              <div>
                <Label htmlFor="value">Value</Label>
                <Input
                  id="value"
                  name="value"
                  type="number"
                  min="1"
                  defaultValue={coupon.value}
                  required
                  className="mt-1"
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="maxUses">Max Uses</Label>
                <Input
                  id="maxUses"
                  name="maxUses"
                  type="number"
                  min="1"
                  defaultValue={coupon.maxUses ?? ""}
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="expiresAt">Expires</Label>
                <Input
                  id="expiresAt"
                  name="expiresAt"
                  type="date"
                  defaultValue={
                    coupon.expiresAt
                      ? format(new Date(coupon.expiresAt), "yyyy-MM-dd")
                      : ""
                  }
                  className="mt-1"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="minOrderCents">Min Order (cents)</Label>
              <Input
                id="minOrderCents"
                name="minOrderCents"
                type="number"
                min="0"
                defaultValue={coupon.minOrderCents ?? ""}
                className="mt-1"
              />
            </div>

            <div className="flex items-center gap-2">
              <input
                type="hidden"
                name="isActive"
                value={coupon.isActive ? "true" : "false"}
              />
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  defaultChecked={coupon.isActive}
                  onChange={(e) => {
                    const hidden = e.target.previousSibling as HTMLInputElement;
                    if (hidden) hidden.value = e.target.checked ? "true" : "false";
                  }}
                />
                Active
              </label>
            </div>

            <p className="text-xs text-muted-foreground">
              Used {coupon.usedCount} times
            </p>

            <Button type="submit" className="w-full">
              Save Changes
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Delete */}
      <Card className="mx-auto max-w-lg border-destructive">
        <CardContent className="flex items-center justify-between pt-6">
          <div>
            <p className="text-sm font-medium">Delete this coupon</p>
            <p className="text-xs text-muted-foreground">
              This action cannot be undone.
            </p>
          </div>
          <form action={deleteCouponAction}>
            <input type="hidden" name="id" value={coupon.id} />
            <Button variant="destructive" size="sm" type="submit">
              <Trash2 className="mr-2 h-4 w-4" />
              Delete
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
