export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { formatPrice } from "@/lib/utils";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Plus, Pencil, Package } from "lucide-react";

function getPackageContents(pkg: { credits: number; courseSlots: number; digitalProductSlots: number }) {
  const parts: string[] = [];
  if (pkg.courseSlots > 0) parts.push(`${pkg.courseSlots} Course${pkg.courseSlots !== 1 ? "s" : ""}`);
  if (pkg.digitalProductSlots > 0) parts.push(`${pkg.digitalProductSlots} Product${pkg.digitalProductSlots !== 1 ? "s" : ""}`);
  if (pkg.credits > 0) parts.push(`${pkg.credits} Credit${pkg.credits !== 1 ? "s" : ""}`);
  return parts.length > 0 ? parts.join(" + ") : "Empty";
}

export default async function AdminPackagesPage() {
  await requireRole("super_admin");

  const packages = await prisma.hybridPackage.findMany({
    orderBy: { sortOrder: "asc" },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold">Packages</h1>
          <p className="text-sm text-muted-foreground">
            Pick-your-own bundles with courses, digital products & session credits.
          </p>
        </div>
        <Button asChild>
          <Link href="/admin/packages/new">
            <Plus className="mr-2 h-4 w-4" />
            Add Package
          </Link>
        </Button>
      </div>

      {packages.length > 0 ? (
        <div className="rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead>Contents</TableHead>
                <TableHead className="text-right">Price</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-20">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {packages.map((pkg) => (
                <TableRow key={pkg.id}>
                  <TableCell className="font-medium">{pkg.title}</TableCell>
                  <TableCell>
                    <span className="text-xs text-muted-foreground">
                      {getPackageContents(pkg)}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    {formatPrice(pkg.priceCents)}
                  </TableCell>
                  <TableCell>
                    <Badge variant={pkg.isPublished ? "default" : "secondary"}>
                      {pkg.isPublished ? "Published" : "Draft"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Button variant="ghost" size="icon" asChild>
                      <Link href={`/admin/packages/${pkg.id}`}>
                        <Pencil className="h-4 w-4" />
                      </Link>
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : (
        <div className="flex flex-col items-center py-12 text-center">
          <Package className="mb-4 h-12 w-12 text-muted-foreground" />
          <p className="text-muted-foreground">No packages created yet.</p>
          <Button className="mt-4" asChild>
            <Link href="/admin/packages/new">Create your first package</Link>
          </Button>
        </div>
      )}
    </div>
  );
}
