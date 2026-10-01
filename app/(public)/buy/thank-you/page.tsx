export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { verifyTransaction } from "@/lib/paystack";
import { settleOrderPayment } from "@/lib/order-paid";
// Only a buy-now reference: this page hands out a download on the reference alone. Cart orders
// (whose reference analytics records on /checkout/success) and older guessable references get the
// generic page and their email.
import { BUY_NOW_REFERENCE } from "@/lib/order-reference";
import { createDownloadToken, DOWNLOAD_LINK_DAYS } from "@/lib/download-token";
import { diffSaDays } from "@/lib/dates";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CheckCircle2, Download, Clock } from "lucide-react";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Thank You",
  robots: { index: false, follow: false },
};


function Shell({ children }: { children: React.ReactNode }) {
  return (
    <section className="px-4 py-16">
      <div className="mx-auto max-w-md">
        <Card>
          <CardContent className="space-y-4 pt-6 text-center">{children}</CardContent>
        </Card>
      </div>
    </section>
  );
}

export default async function BuyThankYouPage({
  searchParams,
}: {
  searchParams: Promise<{ reference?: string; trxref?: string }>;
}) {
  const params = await searchParams;
  const reference = params.reference || params.trxref || "";

  const order = BUY_NOW_REFERENCE.test(reference)
    ? await prisma.order.findUnique({
        where: { paystackReference: reference },
        select: { id: true, status: true, studentId: true, totalCents: true, paidAt: true },
      })
    : null;

  if (!order) {
    return (
      <Shell>
        <p className="text-muted-foreground">
          If you just made a purchase, your download link is on its way to your email.
        </p>
      </Shell>
    );
  }

  // The buyer often arrives before Paystack's webhook does. Ask Paystack directly rather than
  // show "pending" to someone who has just paid; settleOrderPayment is shared with the webhook and
  // only one of them fulfils.
  if (order.status !== "paid" && order.totalCents > 0) {
    const tx = await verifyTransaction(reference).catch(() => null);
    if (tx?.status === "success") {
      await settleOrderPayment({
        orderId: order.id,
        amountCents: tx.amount,
        currency: tx.currency,
        reference,
        actor: "buy-now-return",
      });
    }
  }

  const fresh = await prisma.order.findUnique({
    where: { id: order.id },
    select: {
      status: true,
      paidAt: true,
      items: {
        where: { digitalProductId: { not: null }, isGift: false },
        select: { digitalProductId: true, description: true },
      },
    },
  });

  if (fresh?.status !== "paid") {
    return (
      <Shell>
        <Clock className="mx-auto h-10 w-10 text-muted-foreground" />
        <h1 className="font-heading text-xl font-bold">Waiting for your payment</h1>
        <p className="text-sm text-muted-foreground">
          We haven&rsquo;t had confirmation from the bank yet. As soon as it arrives your download
          link is emailed to you — you can close this page.
        </p>
      </Shell>
    );
  }

  // The page mints links on the reference, so it stops doing so when an emailed link would have
  // expired. After that the buyer has their account (and /forgot-password) like anyone else.
  const withinWindow =
    !fresh.paidAt || diffSaDays(fresh.paidAt, new Date()) < DOWNLOAD_LINK_DAYS;

  return (
    <Shell>
      <CheckCircle2 className="mx-auto h-10 w-10 text-brand-600" />
      <h1 className="font-heading text-xl font-bold">Thank you!</h1>
      {withinWindow ? (
        <>
          <div className="space-y-2">
            {fresh.items.map((item) => (
              <Button key={item.digitalProductId} className="w-full" size="lg" asChild>
                <a href={`/api/products/download?token=${createDownloadToken(order.studentId, item.digitalProductId!)}`}>
                  <Download className="mr-2 h-4 w-4" />
                  Download {item.description}
                </a>
              </Button>
            ))}
          </div>
          <p className="text-sm text-muted-foreground">
            We&rsquo;ve also emailed you the link, so you can download it again later.
          </p>
        </>
      ) : (
        <p className="text-sm text-muted-foreground">
          Your purchase is in your account&rsquo;s downloads. Use &ldquo;Forgot password&rdquo; on
          the login page to set a password if you haven&rsquo;t yet.
        </p>
      )}
    </Shell>
  );
}
