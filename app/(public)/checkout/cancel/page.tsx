import { Button } from "@/components/ui/button";
import { XCircle } from "lucide-react";
import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Checkout Cancelled",
  robots: { index: false, follow: false },
};

export default function CheckoutCancelPage() {
  return (
    <section className="px-4 py-16">
      <div className="mx-auto max-w-lg text-center">
        <XCircle className="mx-auto mb-4 h-16 w-16 text-muted-foreground" />
        <h1 className="font-heading text-2xl font-bold">
          Checkout Cancelled
        </h1>
        <p className="mt-2 text-muted-foreground">
          Your payment was not processed. No charges were made.
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          Your cart items are still saved — you can try again anytime.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Button asChild>
            <Link href="/cart">Return to Cart</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/courses">Browse Courses</Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
