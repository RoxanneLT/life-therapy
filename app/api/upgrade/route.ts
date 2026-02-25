import { NextResponse } from "next/server";
import { getAuthenticatedStudent } from "@/lib/student-auth";
import { initializeTransaction } from "@/lib/paystack";
import { calculateUpgradePrice } from "@/lib/access";
import { createOrderNumber } from "@/lib/order";
import { prisma } from "@/lib/prisma";
import { getBaseUrl } from "@/lib/get-region";

/**
 * POST /api/upgrade
 * Creates a Paystack transaction for upgrading from module access to full course.
 * Requires student authentication.
 */
export async function POST(request: Request) {
  try {
    const auth = await getAuthenticatedStudent();
    if (!auth) {
      return NextResponse.json(
        { error: "Please log in" },
        { status: 401 },
      );
    }

    const body = await request.json();
    const courseId: string = body.courseId;
    if (!courseId) {
      return NextResponse.json(
        { error: "courseId is required" },
        { status: 400 },
      );
    }

    // Verify the student has partial access (module purchases) but not full enrollment
    const existingEnrollment = await prisma.enrollment.findUnique({
      where: {
        studentId_courseId: {
          studentId: auth.student.id,
          courseId,
        },
      },
    });
    if (existingEnrollment) {
      return NextResponse.json(
        { error: "You already own the full course" },
        { status: 400 },
      );
    }

    const { upgradePrice, fullPrice } = await calculateUpgradePrice(
      auth.student.id,
      courseId,
    );

    if (upgradePrice <= 0) {
      return NextResponse.json(
        { error: "No upgrade price to pay" },
        { status: 400 },
      );
    }

    const course = await prisma.course.findUnique({
      where: { id: courseId },
      select: { title: true, slug: true, imageUrl: true },
    });
    if (!course) {
      return NextResponse.json(
        { error: "Course not found" },
        { status: 404 },
      );
    }

    // Create order
    const orderNumber = await createOrderNumber();
    const order = await prisma.order.create({
      data: {
        orderNumber,
        studentId: auth.student.id,
        status: "pending",
        subtotalCents: fullPrice,
        discountCents: fullPrice - upgradePrice,
        totalCents: upgradePrice,
        items: {
          create: [
            {
              courseId,
              description: `${course.title} (Upgrade)`,
              unitPriceCents: upgradePrice,
              quantity: 1,
              totalCents: upgradePrice,
            },
          ],
        },
      },
    });

    // Create Paystack transaction
    const baseUrl = await getBaseUrl();
    const reference = `${order.orderNumber}-${Date.now()}`;

    const paystack = await initializeTransaction({
      email: auth.student.email,
      amount: upgradePrice,
      currency: "ZAR",
      reference,
      callback_url: `${baseUrl}/checkout/success?reference=${reference}`,
      metadata: {
        orderId: order.id,
        orderNumber: order.orderNumber,
        isUpgrade: "true",
      },
    });

    await prisma.order.update({
      where: { id: order.id },
      data: {
        paystackReference: reference,
        paystackAccessCode: paystack.access_code,
      },
    });

    return NextResponse.json({ url: paystack.authorization_url });
  } catch (error) {
    console.error("Upgrade checkout error:", error);
    return NextResponse.json(
      { error: "Failed to create upgrade checkout" },
      { status: 500 },
    );
  }
}
