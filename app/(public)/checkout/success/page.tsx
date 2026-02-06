export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { getStripe } from "@/lib/stripe";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CheckCircle2, Package, Loader2 } from "lucide-react";
import { formatPrice } from "@/lib/utils";
import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Order Confirmed",
};

export default async function CheckoutSuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ session_id?: string }>;
}) {
  const params = await searchParams;
  const sessionId = params.session_id;

  if (!sessionId) {
    return (
      <section className="px-4 py-16">
        <div className="mx-auto max-w-lg text-center">
          <p className="text-muted-foreground">
            No session found. If you just made a purchase, check your email for
            confirmation.
          </p>
          <Button className="mt-6" asChild>
            <Link href="/courses">Browse Courses</Link>
          </Button>
        </div>
      </section>
    );
  }

  // Look up the order via Stripe session metadata
  let order = null;
  try {
    const stripe = getStripe();
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    const orderId = session.metadata?.orderId;

    if (orderId) {
      order = await prisma.order.findUnique({
        where: { id: orderId },
        include: { items: true, student: true },
      });
    }
  } catch {
    // Stripe lookup failed — show generic success
  }

  if (!order) {
    return (
      <section className="px-4 py-16">
        <div className="mx-auto max-w-lg text-center">
          <Loader2 className="mx-auto mb-4 h-12 w-12 animate-spin text-brand-500" />
          <h1 className="font-heading text-2xl font-bold">
            Processing your order...
          </h1>
          <p className="mt-2 text-muted-foreground">
            Your payment was received. You&apos;ll receive a confirmation email
            shortly.
          </p>
          <Button className="mt-6" asChild>
            <Link href="/portal">Go to My Portal</Link>
          </Button>
        </div>
      </section>
    );
  }

  return (
    <section className="px-4 py-16">
      <div className="mx-auto max-w-lg">
        <div className="text-center">
          <CheckCircle2 className="mx-auto mb-4 h-16 w-16 text-green-500" />
          <h1 className="font-heading text-2xl font-bold">
            Thank you for your purchase!
          </h1>
          <p className="mt-2 text-muted-foreground">
            Order <span className="font-mono font-semibold">{order.orderNumber}</span>{" "}
            has been confirmed.
          </p>
        </div>

        <Card className="mt-8">
          <CardContent className="space-y-4 pt-6">
            <h2 className="font-heading text-lg font-semibold">
              Order Summary
            </h2>
            <div className="space-y-3">
              {order.items.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between text-sm"
                >
                  <div className="flex items-center gap-2">
                    <Package className="h-4 w-4 text-muted-foreground" />
                    <span>{item.description}</span>
                  </div>
                  <span className="font-medium">
                    {formatPrice(item.totalCents)}
                  </span>
                </div>
              ))}
            </div>
            <div className="border-t pt-3">
              {order.discountCents > 0 && (
                <div className="flex justify-between text-sm text-green-600">
                  <span>Discount</span>
                  <span>-{formatPrice(order.discountCents)}</span>
                </div>
              )}
              <div className="flex justify-between font-semibold">
                <span>Total</span>
                <span>{formatPrice(order.totalCents)}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="mt-8 text-center">
          <p className="text-sm text-muted-foreground">
            A confirmation email has been sent to{" "}
            <strong>{order.student.email}</strong>.
          </p>
          <div className="mt-4 flex flex-wrap justify-center gap-3">
            <Button asChild>
              <Link href="/portal">Go to My Courses</Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href="/courses">Browse More Courses</Link>
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
