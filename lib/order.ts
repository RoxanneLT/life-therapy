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

/**
 * Process a completed checkout: create enrollments, add credits, handle gifts.
 * Must be idempotent — safe to call multiple times for the same order.
 */
export async function processCheckoutCompleted(orderId: string) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      items: true,
      student: true,
    },
  });

  if (!order) throw new Error(`Order not found: ${orderId}`);
  if (order.status === "paid") return order; // Already processed — idempotent

  // Mark order as paid
  await prisma.order.update({
    where: { id: orderId },
    data: { status: "paid", paidAt: new Date() },
  });

  // Process each item
  for (const item of order.items) {
    if (item.isGift) {
      // Look up gift details from the original cart item
      // Gift recipient info is stored on the OrderItem via the checkout flow
      const cartItem = await prisma.cartItem.findFirst({
        where: {
          courseId: item.courseId,
          hybridPackageId: item.hybridPackageId,
          moduleId: item.moduleId,
          isGift: true,
          cart: { studentId: order.studentId },
        },
      });

      // Create Gift record (uses cart item details or falls back to order info)
      if (cartItem?.giftRecipientEmail) {
        await createGiftFromOrderItem(
          order.id,
          order.studentId,
          {
            id: item.id,
            courseId: item.courseId,
            hybridPackageId: item.hybridPackageId,
            moduleId: item.moduleId,
            description: item.description,
          },
          {
            recipientName: cartItem.giftRecipientName || "Friend",
            recipientEmail: cartItem.giftRecipientEmail,
            message: cartItem.giftMessage,
            deliveryDate: cartItem.giftDeliveryDate,
          }
        );
      }
      continue;
    }

    if (item.courseId) {
      // Enroll in single course (skip if already enrolled)
      await prisma.enrollment.upsert({
        where: {
          studentId_courseId: {
            studentId: order.studentId,
            courseId: item.courseId,
          },
        },
        create: {
          studentId: order.studentId,
          courseId: item.courseId,
          source: "purchase",
          orderId: order.id,
        },
        update: {}, // Already enrolled — no-op
      });
    }

    if (item.moduleId) {
      // Grant standalone module access
      const mod = await prisma.module.findUnique({
        where: { id: item.moduleId },
        select: { courseId: true },
      });
      if (mod) {
        await prisma.moduleAccess.upsert({
          where: {
            studentId_moduleId: {
              studentId: order.studentId,
              moduleId: item.moduleId,
            },
          },
          create: {
            studentId: order.studentId,
            moduleId: item.moduleId,
            courseId: mod.courseId,
            orderId: order.id,
            pricePaid: item.totalCents,
            source: "purchase",
          },
          update: {}, // Already has access — no-op
        });
      }
    }

    if (item.hybridPackageId) {
      // Package: enroll in included courses + add credits
      const pkg = await prisma.hybridPackage.findUnique({
        where: { id: item.hybridPackageId },
        include: { courses: { select: { courseId: true } } },
      });
      if (pkg) {
        // Enroll in all included courses
        for (const pc of pkg.courses) {
          await prisma.enrollment.upsert({
            where: {
              studentId_courseId: {
                studentId: order.studentId,
                courseId: pc.courseId,
              },
            },
            create: {
              studentId: order.studentId,
              courseId: pc.courseId,
              source: "purchase",
              orderId: order.id,
            },
            update: {},
          });
        }

        // Add session credits if included
        if (pkg.credits > 0) {
          const balance = await prisma.sessionCreditBalance.upsert({
            where: { studentId: order.studentId },
            create: {
              studentId: order.studentId,
              balance: pkg.credits * item.quantity,
            },
            update: {
              balance: { increment: pkg.credits * item.quantity },
            },
          });

          await prisma.sessionCreditTransaction.create({
            data: {
              studentId: order.studentId,
              type: "purchase",
              amount: pkg.credits * item.quantity,
              balanceAfter: balance.balance,
              description: `Purchased ${pkg.title}`,
              orderId: order.id,
            },
          });
        }
      }
    }
  }

  // Increment coupon usage if applicable
  if (order.couponId) {
    await prisma.coupon.update({
      where: { id: order.couponId },
      data: { usedCount: { increment: 1 } },
    });
  }

  // Clear the student's cart
  const cart = await prisma.cart.findUnique({
    where: { studentId: order.studentId },
  });
  if (cart) {
    await prisma.cartItem.deleteMany({ where: { cartId: cart.id } });
  }

  return order;
}
