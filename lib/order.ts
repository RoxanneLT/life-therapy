import { prisma } from "@/lib/prisma";
import { createGiftFromOrderItem, sendGiftEmail, type GiftDb } from "@/lib/gift";
import { saToday, saDayStart, addSaDays } from "@/lib/dates";

/** Prisma client or transaction client — fulfilment runs entirely on the latter. */
type Db = GiftDb;

/**
 * Generate a unique order number: LT-YYYYMMDD-NNNN
 *
 * The date stamp and the daily counter are both anchored to the SAST calendar
 * day. Previously the stamp came from the UTC day while the counter window came
 * from local midnight — they only agreed because the server runs UTC, and both
 * were wrong for orders placed between midnight and 02:00 SAST.
 */
export async function createOrderNumber(): Promise<string> {
  const today = saToday();
  const dateStr = today.replace(/-/g, "");

  const startOfDay = saDayStart(today);
  const endOfDay = saDayStart(addSaDays(today, 1));

  const count = await prisma.order.count({
    where: { createdAt: { gte: startOfDay, lt: endOfDay } },
  });

  const seq = String(count + 1).padStart(4, "0");
  return `LT-${dateStr}-${seq}`;
}

/** Process a gift order item: look up cart details and create Gift record.
 *  Returns the id of a gift that must be emailed once the transaction commits. */
async function processGiftItem(
  db: Db,
  item: { id: string; courseId: string | null; hybridPackageId: string | null; moduleId: string | null; digitalProductId: string | null; packageSelections: unknown; description: string },
  orderId: string,
  studentId: string,
): Promise<string | null> {
  const cartItem = await db.cartItem.findFirst({
    where: {
      courseId: item.courseId,
      hybridPackageId: item.hybridPackageId,
      moduleId: item.moduleId,
      isGift: true,
      cart: { studentId },
    },
  });

  if (!cartItem?.giftRecipientEmail) return null;

  const gift = await createGiftFromOrderItem(
    orderId,
    studentId,
    item,
    {
      recipientName: cartItem.giftRecipientName || "Friend",
      recipientEmail: cartItem.giftRecipientEmail,
      message: cartItem.giftMessage,
      deliveryDate: cartItem.giftDeliveryDate,
    },
    db,
  );

  // Scheduled gifts are delivered by the cron; unscheduled ones go out on commit.
  return cartItem.giftDeliveryDate ? null : gift.id;
}

/** Process a non-gift order item: enroll in courses, grant access, add credits */
async function processOrderItem(
  db: Db,
  item: { courseId: string | null; moduleId: string | null; digitalProductId: string | null; hybridPackageId: string | null; packageSelections: unknown; totalCents: number; quantity: number },
  orderId: string,
  studentId: string,
) {
  if (item.courseId) {
    await db.enrollment.upsert({
      where: { studentId_courseId: { studentId, courseId: item.courseId } },
      create: { studentId, courseId: item.courseId, source: "purchase", orderId },
      update: {},
    });
  }

  if (item.moduleId) {
    const mod = await db.module.findUnique({ where: { id: item.moduleId }, select: { courseId: true } });
    if (mod) {
      await db.moduleAccess.upsert({
        where: { studentId_moduleId: { studentId, moduleId: item.moduleId } },
        create: { studentId, moduleId: item.moduleId, courseId: mod.courseId, orderId, pricePaid: item.totalCents, source: "purchase" },
        update: {},
      });
    }
  }

  if (item.digitalProductId) {
    await db.digitalProductAccess.upsert({
      where: { studentId_digitalProductId: { studentId, digitalProductId: item.digitalProductId } },
      create: { studentId, digitalProductId: item.digitalProductId, source: "purchase", orderId },
      update: {},
    });
  }

  if (item.hybridPackageId) {
    await processPackageItem(db, item, orderId, studentId);
  }
}

/** Process a hybrid package order item: selections + credits */
async function processPackageItem(
  db: Db,
  item: { hybridPackageId: string | null; packageSelections: unknown; quantity: number },
  orderId: string,
  studentId: string,
) {
  const pkg = await db.hybridPackage.findUnique({ where: { id: item.hybridPackageId! } });
  if (!pkg) return;

  const selections = item.packageSelections as { courseIds?: string[]; moduleIds?: string[]; digitalProductIds?: string[] } | null;

  for (const courseId of selections?.courseIds || []) {
    await db.enrollment.upsert({
      where: { studentId_courseId: { studentId, courseId } },
      create: { studentId, courseId, source: "purchase", orderId },
      update: {},
    });
  }

  for (const moduleId of selections?.moduleIds || []) {
    const mod = await db.module.findUnique({ where: { id: moduleId }, select: { courseId: true } });
    if (!mod) continue;
    await db.moduleAccess.upsert({
      where: { studentId_moduleId: { studentId, moduleId } },
      create: { studentId, moduleId, courseId: mod.courseId, source: "purchase", orderId },
      update: {},
    });
  }

  for (const dpId of selections?.digitalProductIds || []) {
    await db.digitalProductAccess.upsert({
      where: { studentId_digitalProductId: { studentId, digitalProductId: dpId } },
      create: { studentId, digitalProductId: dpId, source: "purchase", orderId },
      update: {},
    });
  }

  if (pkg.credits > 0) {
    const creditAmount = pkg.credits * item.quantity;
    const balance = await db.sessionCreditBalance.upsert({
      where: { studentId },
      create: { studentId, balance: creditAmount },
      update: { balance: { increment: creditAmount } },
    });
    await db.sessionCreditTransaction.create({
      data: { studentId, type: "purchase", amount: creditAmount, balanceAfter: balance.balance, description: `Purchased ${pkg.title}`, orderId },
    });
  }
}

/**
 * Fulfil a paid checkout: enrolments, access grants, credits, gifts, coupon count.
 *
 * Idempotent AND crash-safe, which the previous version was neither of. It read the
 * status, returned early if "paid", then marked the order paid and granted afterwards:
 *
 *   · Concurrent webhook redelivery (Paystack retries) — two calls both read "pending"
 *     before either wrote, so both ran the grant loop. Session credits credited twice,
 *     coupon usedCount incremented twice.
 *   · A crash between the mark-paid write and the grants left the client charged with
 *     nothing granted — and every retry short-circuited on "already paid", so it could
 *     never self-heal. Only hand-written SQL could repair it.
 *
 * Both come from the same root: the claim and the work were not atomic. Now the claim
 * is an `updateMany` filtered on `status: { not: "paid" }` — the database decides the
 * winner, and it returns the number of rows it actually changed, so a loser sees 0 and
 * stops. The whole thing runs in one transaction, so a failure anywhere rolls back the
 * claim too and the next retry legitimately re-runs.
 *
 * Emails are deliberately NOT sent inside the transaction — see the tail.
 */
export async function processCheckoutCompleted(orderId: string) {
  const giftsToEmail: string[] = [];

  const order = await prisma.$transaction(async (tx) => {
    const claimed = await tx.order.updateMany({
      where: { id: orderId, status: { not: "paid" } },
      data: { status: "paid", paidAt: new Date() },
    });

    // 0 rows → either the order is gone, or another delivery of this same webhook
    // already claimed it. Either way this call must not grant anything.
    if (claimed.count === 0) return null;

    const found = await tx.order.findUnique({
      where: { id: orderId },
      include: { items: true, student: true },
    });
    if (!found) throw new Error(`Order not found: ${orderId}`);

    for (const item of found.items) {
      if (item.isGift) {
        const giftId = await processGiftItem(tx, item, found.id, found.studentId);
        if (giftId) giftsToEmail.push(giftId);
      } else {
        await processOrderItem(tx, item, found.id, found.studentId);
      }
    }

    if (found.couponId) {
      await tx.coupon.update({
        where: { id: found.couponId },
        data: { usedCount: { increment: 1 } },
      });
    }

    const cart = await tx.cart.findUnique({ where: { studentId: found.studentId } });
    if (cart) {
      await tx.cartItem.deleteMany({ where: { cartId: cart.id } });
    }

    return found;
  });

  // null = this call did NOT fulfil the order (another delivery of the same webhook
  // won the claim). The webhook already guards its follow-ups on the return value, so
  // this also stops a duplicate order-confirmation email and a duplicate invoice —
  // which the old early-return only avoided when the two deliveries didn't overlap.
  if (!order) return null;

  // Gift emails go out only once the grants are durably committed. Inside the
  // transaction they would either hold it open across a network call, or deliver a
  // gift that a rollback then erased.
  for (const giftId of giftsToEmail) {
    await sendGiftEmail(giftId).catch((err) =>
      console.error(`Failed to send gift email ${giftId}:`, err),
    );
  }

  return order;
}
