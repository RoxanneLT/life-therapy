import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { prisma } from "../lib/prisma";

async function clearPurchases() {
  const student = await prisma.student.findUnique({
    where: { email: "roxannebouwer@gmail.com" },
    select: { id: true, firstName: true, lastName: true },
  });

  if (!student) {
    console.log("Student not found");
    return;
  }

  console.log("Found student:", student.id, student.firstName, student.lastName);

  const orders = await prisma.order.findMany({
    where: { studentId: student.id },
    select: { id: true },
  });
  console.log("Orders to delete:", orders.length);

  const orderItems = await prisma.orderItem.deleteMany({
    where: { orderId: { in: orders.map((o) => o.id) } },
  });
  console.log("Deleted order items:", orderItems.count);

  const deletedOrders = await prisma.order.deleteMany({
    where: { studentId: student.id },
  });
  console.log("Deleted orders:", deletedOrders.count);

  const enrollments = await prisma.enrollment.deleteMany({
    where: { studentId: student.id },
  });
  console.log("Deleted enrollments:", enrollments.count);

  const moduleAccess = await prisma.moduleAccess.deleteMany({
    where: { studentId: student.id },
  });
  console.log("Deleted module access:", moduleAccess.count);

  const digitalAccess = await prisma.digitalProductAccess.deleteMany({
    where: { studentId: student.id },
  });
  console.log("Deleted digital product access:", digitalAccess.count);

  console.log("\nDone — all purchase history cleared for roxannebouwer@gmail.com");
}

clearPurchases()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
