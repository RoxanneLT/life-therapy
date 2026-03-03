"use client";

import { useActionState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Link from "next/link";
import { ArrowLeft, Loader2, Trash2 } from "lucide-react";
import { updateCouponAction, deleteCouponAction } from "../actions";

interface SerializedCoupon {
  id: string;
  code: string;
  type: string;
  value: number;
  valueUsd: number | null;
  valueEur: number | null;
  valueGbp: number | null;
  maxUses: number | null;
  expiresAt: string | null;
  minOrderCents: number | null;
  isActive: boolean;
  usedCount: number;
}

export function EditCouponForm({ coupon }: Readonly<{ coupon: SerializedCoupon }>) {
  const [state, formAction, isPending] = useActionState(updateCouponAction, null);

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
          <form action={formAction} className="space-y-4">
            <input type="hidden" name="id" value={coupon.id} />

            {state?.error && (
              <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                {state.error}
              </div>
            )}

            <div>
              <Label htmlFor="code">Code</Label>
              <Input
                id="code"
                name="code"
                defaultValue={coupon.code}
                required
                className="mt-1 uppercase"
                disabled={isPending}
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
                  disabled={isPending}
                >
                  <option value="percentage">Percentage</option>
                  <option value="fixed_amount">Fixed Amount (cents)</option>
                </select>
              </div>
              <div>
                <Label htmlFor="value">Value (ZAR cents / %)</Label>
                <Input
                  id="value"
                  name="value"
                  type="number"
                  min="1"
                  defaultValue={coupon.value}
                  required
                  className="mt-1"
                  disabled={isPending}
                />
              </div>
            </div>

            <div className="rounded-md border bg-muted/30 p-3">
              <p className="mb-2 text-xs font-medium text-muted-foreground">
                Multi-currency values (fixed amount only, leave blank to use ZAR value)
              </p>
              <div className="grid gap-3 sm:grid-cols-3">
                <div>
                  <Label htmlFor="valueUsd" className="text-xs">USD (cents)</Label>
                  <Input
                    id="valueUsd"
                    name="valueUsd"
                    type="number"
                    min="0"
                    defaultValue={coupon.valueUsd ?? ""}
                    placeholder="e.g. 500"
                    className="mt-1"
                    disabled={isPending}
                  />
                </div>
                <div>
                  <Label htmlFor="valueEur" className="text-xs">EUR (cents)</Label>
                  <Input
                    id="valueEur"
                    name="valueEur"
                    type="number"
                    min="0"
                    defaultValue={coupon.valueEur ?? ""}
                    placeholder="e.g. 450"
                    className="mt-1"
                    disabled={isPending}
                  />
                </div>
                <div>
                  <Label htmlFor="valueGbp" className="text-xs">GBP (cents)</Label>
                  <Input
                    id="valueGbp"
                    name="valueGbp"
                    type="number"
                    min="0"
                    defaultValue={coupon.valueGbp ?? ""}
                    placeholder="e.g. 400"
                    className="mt-1"
                    disabled={isPending}
                  />
                </div>
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
                  disabled={isPending}
                />
              </div>
              <div>
                <Label htmlFor="expiresAt">Expires</Label>
                <Input
                  id="expiresAt"
                  name="expiresAt"
                  type="date"
                  defaultValue={coupon.expiresAt ?? ""}
                  className="mt-1"
                  disabled={isPending}
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
                disabled={isPending}
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
                    const hidden = (e.target.parentElement?.parentElement?.querySelector(
                      'input[name="isActive"]'
                    ) as HTMLInputElement);
                    if (hidden) hidden.value = e.target.checked ? "true" : "false";
                  }}
                  disabled={isPending}
                />
                Active
              </label>
            </div>

            <p className="text-xs text-muted-foreground">
              Used {coupon.usedCount} times
            </p>

            <Button type="submit" className="w-full" disabled={isPending}>
              {isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save Changes"
              )}
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
