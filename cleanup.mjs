import { PrismaClient } from './lib/generated/prisma/index.js';
const prisma = new PrismaClient();

const student = await prisma.student.findUnique({ where: { email: 'roxannebouwer@gmail.com' }, select: { id: true, email: true } });
console.log('Student:', student);
if (!student) { console.log('Not found'); process.exit(0); }

const [enrollments, moduleAccess, orders] = await Promise.all([
  prisma.enrollment.findMany({ where: { studentId: student.id }, select: { id: true, courseId: true } }),
  prisma.moduleAccess.findMany({ where: { studentId: student.id }, select: { id: true, moduleId: true } }),
  prisma.order.findMany({ where: { studentId: student.id }, select: { id: true, orderNumber: true, status: true } }),
]);

console.log('Enrollments:', JSON.stringify(enrollments));
console.log('ModuleAccess:', JSON.stringify(moduleAccess));
console.log('Orders:', JSON.stringify(orders));

await prisma.$disconnect();
