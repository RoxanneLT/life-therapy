export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { Gift } from "lucide-react";
import type { Metadata } from "next";
import { RedeemClient } from "./redeem-client";

export const metadata: Metadata = {
  title: "Redeem Your Gift",
  robots: { index: false, follow: false },
};

export default async function RedeemGiftPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const params = await searchParams;
  const token = params.token;

  if (!token) {
    return (
      <section className="px-4 py-16">
        <div className="mx-auto max-w-md text-center">
          <Gift className="mx-auto mb-4 h-16 w-16 text-muted-foreground" />
          <h1 className="font-heading text-2xl font-bold">Invalid Gift Link</h1>
          <p className="mt-2 text-muted-foreground">
            This gift link is missing a token. Please check the link in your
            email and try again.
          </p>
        </div>
      </section>
    );
  }

  const gift = await prisma.gift.findUnique({
    where: { redeemToken: token },
    include: {
      buyer: { select: { firstName: true, lastName: true } },
      course: { select: { title: true } },
      hybridPackage: { select: { title: true } },
    },
  });

  if (!gift) {
    return (
      <section className="px-4 py-16">
        <div className="mx-auto max-w-md text-center">
          <Gift className="mx-auto mb-4 h-16 w-16 text-muted-foreground" />
          <h1 className="font-heading text-2xl font-bold">Gift Not Found</h1>
          <p className="mt-2 text-muted-foreground">
            We couldn&apos;t find this gift. It may have already been redeemed
            or the link is incorrect.
          </p>
        </div>
      </section>
    );
  }

  if (gift.status === "redeemed") {
    return (
      <section className="px-4 py-16">
        <div className="mx-auto max-w-md text-center">
          <Gift className="mx-auto mb-4 h-16 w-16 text-green-500" />
          <h1 className="font-heading text-2xl font-bold">
            Already Redeemed
          </h1>
          <p className="mt-2 text-muted-foreground">
            This gift has already been redeemed. Log in to your portal to access
            your courses.
          </p>
        </div>
      </section>
    );
  }

  if (gift.status === "cancelled") {
    return (
      <section className="px-4 py-16">
        <div className="mx-auto max-w-md text-center">
          <Gift className="mx-auto mb-4 h-16 w-16 text-muted-foreground" />
          <h1 className="font-heading text-2xl font-bold">Gift Cancelled</h1>
          <p className="mt-2 text-muted-foreground">
            This gift has been cancelled by the sender.
          </p>
        </div>
      </section>
    );
  }

  const itemTitle =
    gift.course?.title ||
    gift.hybridPackage?.title ||
    (gift.creditAmount ? `${gift.creditAmount} Session Credits` : "Gift");
  const buyerName = `${gift.buyer.firstName} ${gift.buyer.lastName}`;

  // Check if recipient already has an account
  const existingStudent = await prisma.student.findUnique({
    where: { email: gift.recipientEmail },
  });

  return (
    <section className="px-4 py-16">
      <div className="mx-auto max-w-md">
        <RedeemClient
          token={token}
          itemTitle={itemTitle}
          buyerName={buyerName}
          message={gift.message}
          recipientEmail={gift.recipientEmail}
          hasExistingAccount={!!existingStudent}
        />
      </div>
    </section>
  );
}
