import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email";
import { giftReceivedEmail, giftDeliveredToBuyerEmail } from "@/lib/email-templates";
import { findOrCreateStudent } from "@/lib/account-provisioning";

/**
 * Create a Gift record for a gift order item.
 * Called during checkout processing.
 */
export async function createGiftFromOrderItem(
  orderId: string,
  buyerId: string,
  item: {
    id: string;
    courseId: string | null;
    hybridPackageId: string | null;
    moduleId: string | null;
    description: string;
  },
  giftDetails: {
    recipientName: string;
    recipientEmail: string;
    message?: string | null;
    deliveryDate?: Date | null;
  }
) {
  // Determine credit amount if it's a package with credits
  let creditAmount: number | null = null;
  if (item.hybridPackageId) {
    const pkg = await prisma.hybridPackage.findUnique({
      where: { id: item.hybridPackageId },
      select: { credits: true },
    });
    if (pkg && pkg.credits > 0) creditAmount = pkg.credits;
  }

  const gift = await prisma.gift.create({
    data: {
      orderId,
      buyerId,
      recipientEmail: giftDetails.recipientEmail,
      recipientName: giftDetails.recipientName,
      message: giftDetails.message || null,
      deliveryDate: giftDetails.deliveryDate || null,
      courseId: item.courseId,
      hybridPackageId: item.hybridPackageId,
      moduleId: item.moduleId,
      creditAmount,
      status: giftDetails.deliveryDate ? "pending" : "delivered",
    },
  });

  // Link gift to order item
  await prisma.orderItem.update({
    where: { id: item.id },
    data: { giftId: gift.id },
  });

  // If no scheduled delivery date, send immediately
  if (!giftDetails.deliveryDate) {
    await sendGiftEmail(gift.id);
  }

  return gift;
}

/**
 * Send the gift notification email to the recipient.
 */
export async function sendGiftEmail(giftId: string) {
  const gift = await prisma.gift.findUnique({
    where: { id: giftId },
    include: {
      buyer: { select: { firstName: true, lastName: true } },
      course: { select: { title: true } },
      hybridPackage: { select: { title: true } },
      module: { select: { standaloneTitle: true, title: true } },
    },
  });

  if (!gift) return;

  const mod = gift.module as { standaloneTitle: string | null; title: string } | null;
  const itemTitle =
    gift.course?.title ||
    gift.hybridPackage?.title ||
    mod?.standaloneTitle ||
    mod?.title ||
    "Session Credits";
  const buyerName = `${gift.buyer.firstName} ${gift.buyer.lastName}`;
  const redeemUrl = `https://life-therapy.co.za/gift/redeem?token=${gift.redeemToken}`;

  const { subject, html } = giftReceivedEmail({
    recipientName: gift.recipientName,
    buyerName,
    itemTitle,
    message: gift.message,
    redeemUrl,
  });

  await sendEmail({
    to: gift.recipientEmail,
    subject,
    html,
  });

  // Mark as delivered and record send time
  await prisma.gift.update({
    where: { id: giftId },
    data: {
      status: "delivered",
      emailSentAt: new Date(),
    },
  });

  // Notify the buyer that their gift was delivered (non-blocking)
  const buyerStudent = await prisma.student.findUnique({
    where: { id: gift.buyerId },
    select: { email: true },
  });
  if (buyerStudent) {
    const notification = giftDeliveredToBuyerEmail({
      buyerName: buyerName,
      recipientName: gift.recipientName,
      itemTitle,
    });
    sendEmail({
      to: buyerStudent.email,
      subject: notification.subject,
      html: notification.html,
    }).catch((err) =>
      console.error("Failed to send gift delivery notification to buyer:", err)
    );
  }
}

/**
 * Redeem a gift: create student if needed, enroll in course/bundle or add credits.
 */
export async function redeemGift(
  token: string,
  recipientInfo?: {
    firstName: string;
    lastName: string;
    password: string;
  }
) {
  const gift = await prisma.gift.findUnique({
    where: { redeemToken: token },
    include: {
      course: { select: { id: true, title: true } },
      hybridPackage: {
        select: {
          id: true,
          title: true,
          credits: true,
          courses: { select: { courseId: true } },
        },
      },
      module: { select: { id: true, courseId: true, standalonePrice: true } },
    },
  });

  if (!gift) return { error: "Gift not found" };
  if (gift.status === "redeemed") return { error: "This gift has already been redeemed" };
  if (gift.status === "cancelled") return { error: "This gift has been cancelled" };

  // Find or create the recipient student
  let studentId: string;
  if (gift.recipientId) {
    // Already linked to a student
    studentId = gift.recipientId;
  } else if (recipientInfo) {
    // Create new student
    const result = await findOrCreateStudent(
      gift.recipientEmail,
      recipientInfo.firstName,
      recipientInfo.lastName
    );
    studentId = result.id;

    // If existing student, no need to set password
    // If new student, the password was set during findOrCreateStudent
    // Actually, findOrCreateStudent creates with a temp password.
    // We need to update their password if they provided one.
    if (result.isNew && recipientInfo.password) {
      const { supabaseAdmin } = await import("@/lib/supabase-admin");
      const student = await prisma.student.findUnique({
        where: { id: studentId },
        select: { supabaseUserId: true },
      });
      if (student) {
        await supabaseAdmin.auth.admin.updateUserById(
          student.supabaseUserId,
          { password: recipientInfo.password }
        );
        await prisma.student.update({
          where: { id: studentId },
          data: { mustChangePassword: false },
        });
      }
    }
  } else {
    return { error: "Account information required" };
  }

  // Enroll in course(s) or add credits
  if (gift.courseId) {
    await prisma.enrollment.upsert({
      where: {
        studentId_courseId: {
          studentId,
          courseId: gift.courseId,
        },
      },
      create: {
        studentId,
        courseId: gift.courseId,
        source: "gift",
        giftId: gift.id,
      },
      update: {},
    });
  }

  if (gift.moduleId && gift.module) {
    await prisma.moduleAccess.upsert({
      where: {
        studentId_moduleId: {
          studentId,
          moduleId: gift.moduleId,
        },
      },
      create: {
        studentId,
        moduleId: gift.moduleId,
        courseId: gift.module.courseId,
        pricePaid: gift.module.standalonePrice || 0,
        source: "gift",
      },
      update: {},
    });
  }

  if (gift.hybridPackageId && gift.hybridPackage) {
    // Enroll in all included courses
    for (const pc of gift.hybridPackage.courses) {
      await prisma.enrollment.upsert({
        where: {
          studentId_courseId: {
            studentId,
            courseId: pc.courseId,
          },
        },
        create: {
          studentId,
          courseId: pc.courseId,
          source: "gift",
          giftId: gift.id,
        },
        update: {},
      });
    }
  }

  if (gift.creditAmount && gift.creditAmount > 0) {
    const balance = await prisma.sessionCreditBalance.upsert({
      where: { studentId },
      create: { studentId, balance: gift.creditAmount },
      update: { balance: { increment: gift.creditAmount } },
    });

    await prisma.sessionCreditTransaction.create({
      data: {
        studentId,
        type: "gift_received",
        amount: gift.creditAmount,
        balanceAfter: balance.balance,
        description: `Gift from ${gift.recipientName}`,
      },
    });
  }

  // Mark gift as redeemed
  await prisma.gift.update({
    where: { id: gift.id },
    data: {
      status: "redeemed",
      recipientId: studentId,
      redeemedAt: new Date(),
    },
  });

  return { success: true };
}
