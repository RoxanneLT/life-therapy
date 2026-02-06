export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { format } from "date-fns";
import Link from "next/link";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Users } from "lucide-react";

export default async function StudentsPage() {
  await requireRole("super_admin");

  const students = await prisma.student.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      _count: { select: { enrollments: true, orders: true } },
      creditBalance: { select: { balance: true } },
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold">Students</h1>
          <p className="text-sm text-muted-foreground">
            {students.length} registered students
          </p>
        </div>
      </div>

      {students.length === 0 ? (
        <div className="flex flex-col items-center py-16 text-center">
          <Users className="mb-4 h-12 w-12 text-muted-foreground" />
          <p className="text-muted-foreground">No students registered yet.</p>
        </div>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead className="text-center">Courses</TableHead>
                <TableHead className="text-center">Orders</TableHead>
                <TableHead className="text-center">Credits</TableHead>
                <TableHead>Joined</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {students.map((s) => (
                <TableRow key={s.id}>
                  <TableCell>
                    <Link
                      href={`/admin/students/${s.id}`}
                      className="font-medium text-brand-600 hover:underline"
                    >
                      {s.firstName} {s.lastName}
                    </Link>
                    {s.mustChangePassword && (
                      <Badge variant="outline" className="ml-2 text-xs">
                        Temp PW
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-sm">{s.email}</TableCell>
                  <TableCell className="text-center">
                    {s._count.enrollments}
                  </TableCell>
                  <TableCell className="text-center">
                    {s._count.orders}
                  </TableCell>
                  <TableCell className="text-center">
                    {s.creditBalance?.balance ?? 0}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {format(new Date(s.createdAt), "d MMM yyyy")}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
