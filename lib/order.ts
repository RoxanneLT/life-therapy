import { prisma } from "@/lib/prisma";
import { createGiftFromOrderItem } from "@/lib/gift";

/**
 * Generate a unique order number: LT-YYYYMMDD-NNNN
 */
export async function createOrderNumber(): Promise<string> {
  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10).replace(/-/g, "");

  const startOfDay = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate()
  );
  const endOfDay = new Date(startOfDay.getTime() + 86_400_000);

  const count = await prisma.order.count({
    where: { createdAt: { gte: startOfDay, lt: endOfDay } },
  });

  const seq = String(count + 1).padStart(4, "0");
  return `LT-${dateStr}-${seq}`;
}

/** Process a gift order item: look up cart details and create Gift record */
async function processGiftItem(
  item: { id: string; courseId: string | null; hybridPackageId: string | null; moduleId: string | null; digitalProductId: string | null; packageSelections: unknown; description: string },
  orderId: string,
  studentId: string,
) {
  const cartItem = await prisma.cartItem.findFirst({
    where: {
      courseId: item.courseId,
      hybridPackageId: item.hybridPackageId,
      moduleId: item.moduleId,
      isGift: true,
      cart: { studentId },
    },
  });

  if (cartItem?.giftRecipientEmail) {
    await createGiftFromOrderItem(orderId, studentId, item, {
      recipientName: cartItem.giftRecipientName || "Friend",
      recipientEmail: cartItem.giftRecipientEmail,
      message: cartItem.giftMessage,
      deliveryDate: cartItem.giftDeliveryDate,
    });
  }
}

/** Process a non-gift order item: enroll in courses, grant access, add credits */
async function processOrderItem(
  item: { courseId: string | null; moduleId: string | null; digitalProductId: string | null; hybridPackageId: string | null; packageSelections: unknown; totalCents: number; quantity: number },
  orderId: string,
  studentId: string,
) {
  if (item.courseId) {
    await prisma.enrollment.upsert({
      where: { studentId_courseId: { studentId, courseId: item.courseId } },
      create: { studentId, courseId: item.courseId, source: "purchase", orderId },
      update: {},
    });
  }

  if (item.moduleId) {
    const mod = await prisma.module.findUnique({ where: { id: item.moduleId }, select: { courseId: true } });
    if (mod) {
      await prisma.moduleAccess.upsert({
        where: { studentId_moduleId: { studentId, moduleId: item.moduleId } },
        create: { studentId, moduleId: item.moduleId, courseId: mod.courseId, orderId, pricePaid: item.totalCents, source: "purchase" },
        update: {},
      });
    }
  }

  if (item.digitalProductId) {
    await prisma.digitalProductAccess.upsert({
      where: { studentId_digitalProductId: { studentId, digitalProductId: item.digitalProductId } },
      create: { studentId, digitalProductId: item.digitalProductId, source: "purchase", orderId },
      update: {},
    });
  }

  if (item.hybridPackageId) {
    await processPackageItem(item, orderId, studentId);
  }
}

/** Process a hybrid package order item: selections + credits */
async function processPackageItem(
  item: { hybridPackageId: string | null; packageSelections: unknown; quantity: number },
  orderId: string,
  studentId: string,
) {
  const pkg = await prisma.hybridPackage.findUnique({ where: { id: item.hybridPackageId! } });
  if (!pkg) return;

  const selections = item.packageSelections as { courseIds?: string[]; digitalProductIds?: string[] } | null;

  for (const courseId of selections?.courseIds || []) {
    await prisma.enrollment.upsert({
      where: { studentId_courseId: { studentId, courseId } },
      create: { studentId, courseId, source: "purchase", orderId },
      update: {},
    });
  }

  for (const dpId of selections?.digitalProductIds || []) {
    await prisma.digitalProductAccess.upsert({
      where: { studentId_digitalProductId: { studentId, digitalProductId: dpId } },
      create: { studentId, digitalProductId: dpId, source: "purchase", orderId },
      update: {},
    });
  }

  if (pkg.credits > 0) {
    const creditAmount = pkg.credits * item.quantity;
    const balance = await prisma.sessionCreditBalance.upsert({
      where: { studentId },
      create: { studentId, balance: creditAmount },
      update: { balance: { increment: creditAmount } },
    });
    await prisma.sessionCreditTransaction.create({
      data: { studentId, type: "purchase", amount: creditAmount, balanceAfter: balance.balance, description: `Purchased ${pkg.title}`, orderId },
    });
  }
}

/**
 * Process a completed checkout: create enrollments, add credits, handle gifts.
 * Must be idempotent — safe to call multiple times for the same order.
 */
export async function processCheckoutCompleted(orderId: string) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { items: true, student: true },
  });

  if (!order) throw new Error(`Order not found: ${orderId}`);
  if (order.status === "paid") return order;

  await prisma.order.update({
    where: { id: orderId },
    data: { status: "paid", paidAt: new Date() },
  });

  for (const item of order.items) {
    if (item.isGift) {
      await processGiftItem(item, order.id, order.studentId);
    } else {
      await processOrderItem(item, order.id, order.studentId);
    }
  }

  if (order.couponId) {
    await prisma.coupon.update({
      where: { id: order.couponId },
      data: { usedCount: { increment: 1 } },
    });
  }

  const cart = await prisma.cart.findUnique({ where: { studentId: order.studentId } });
  if (cart) {
    await prisma.cartItem.deleteMany({ where: { cartId: cart.id } });
  }

  return order;
}
