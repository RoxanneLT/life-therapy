"use client";

import { useActionState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Link from "next/link";
import { ArrowLeft, Loader2 } from "lucide-react";
import { createCouponAction } from "../actions";

export function NewCouponForm() {
  const [state, formAction, isPending] = useActionState(createCouponAction, null);

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
          <form action={formAction} className="space-y-4">
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
                placeholder="e.g. SAVE20"
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
                  required
                  placeholder="e.g. 20 for 20%"
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
                    placeholder="e.g. 400"
                    className="mt-1"
                    disabled={isPending}
                  />
                </div>
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
                  disabled={isPending}
                />
              </div>
              <div>
                <Label htmlFor="expiresAt">Expires (optional)</Label>
                <Input
                  id="expiresAt"
                  name="expiresAt"
                  type="date"
                  className="mt-1"
                  disabled={isPending}
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
                disabled={isPending}
              />
            </div>

            <Button type="submit" className="w-full" disabled={isPending}>
              {isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating...
                </>
              ) : (
                "Create Coupon"
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
