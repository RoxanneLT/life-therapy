export const dynamic = "force-dynamic";

import { requireRole } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { createCouponAction } from "../actions";

export default async function NewCouponPage() {
  await requireRole("super_admin");

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/admin/coupons">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Link>
        </Button>
        <h1 className="font-heading text-2xl font-bold">New Coupon</h1>
      </div>

      <Card className="mx-auto max-w-lg">
        <CardHeader>
          <CardTitle className="text-base">Coupon Details</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={createCouponAction} className="space-y-4">
            <div>
              <Label htmlFor="code">Code</Label>
              <Input
                id="code"
                name="code"
                placeholder="e.g. SAVE20"
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
                  required
                  placeholder="e.g. 20 for 20%"
                  className="mt-1"
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="maxUses">Max Uses (optional)</Label>
                <Input
                  id="maxUses"
                  name="maxUses"
                  type="number"
                  min="1"
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="expiresAt">Expires (optional)</Label>
                <Input
                  id="expiresAt"
                  name="expiresAt"
                  type="date"
                  className="mt-1"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="minOrderCents">
                Min Order (cents, optional)
              </Label>
              <Input
                id="minOrderCents"
                name="minOrderCents"
                type="number"
                min="0"
                className="mt-1"
                placeholder="e.g. 50000 for R500"
              />
            </div>

            <Button type="submit" className="w-full">
              Create Coupon
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
