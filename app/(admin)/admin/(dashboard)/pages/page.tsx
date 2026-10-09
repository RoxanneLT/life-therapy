export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/admin/page-header";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Pencil } from "lucide-react";

export default async function AdminPagesPage() {
  const pages = await prisma.page.findMany({
    orderBy: { sortOrder: "asc" },
    include: { _count: { select: { sections: true } } },
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Pages"
        description="Manage your website page content and sections."
      />

      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Title</TableHead>
              <TableHead>Slug</TableHead>
              <TableHead>Sections</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-20">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {pages.map((page) => (
              <TableRow key={page.id}>
                <TableCell className="font-medium">{page.title}</TableCell>
                <TableCell className="text-muted-foreground">
                  /{page.slug === "home" ? "" : page.slug}
                </TableCell>
                <TableCell>{page._count.sections}</TableCell>
                <TableCell>
                  <Badge
                    variant={page.isPublished ? "default" : "secondary"}
                  >
                    {page.isPublished ? "Published" : "Draft"}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Button variant="ghost" size="icon" asChild aria-label="Edit page">
                    <Link href={`/admin/pages/${page.slug}`}>
                      <Pencil className="h-4 w-4" />
                    </Link>
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
