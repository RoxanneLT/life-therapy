export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
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
import { Plus, Star } from "lucide-react";
import { SettingsPageHeader } from "@/components/admin/settings/settings-page-header";
import { EmptyState } from "@/components/admin/empty-state";
import { TestimonialRowActions } from "./testimonial-row-actions";

export default async function AdminTestimonialsPage() {
  const testimonials = await prisma.testimonial.findMany({
    orderBy: { sortOrder: "asc" },
  });

  return (
    <div>
      <SettingsPageHeader
        title="Testimonials"
        description={`${testimonials.length} testimonial${testimonials.length === 1 ? "" : "s"} — client reviews shown on the site`}
        actions={
          <Button asChild>
            <Link href="/admin/testimonials/new">
              <Plus className="mr-2 h-4 w-4" />
              Add Testimonial
            </Link>
          </Button>
        }
      />

      {testimonials.length === 0 ? (
        <EmptyState icon={Star} message="No testimonials yet. Add your first one." />
      ) : (
        <div className="rounded-md border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Rating</TableHead>
                <TableHead>Testimonial</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {testimonials.map((t) => (
                <TableRow key={t.id}>
                  <TableCell className="align-top">
                    <p className="font-medium">{t.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {t.role}
                      {t.location && ` — ${t.location}`}
                    </p>
                  </TableCell>
                  <TableCell className="align-top">
                    <div className="flex gap-0.5">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Star
                          key={i}
                          className={`h-3 w-3 ${
                            i < t.rating
                              ? "fill-yellow-400 text-yellow-400"
                              : "text-muted-foreground"
                          }`}
                        />
                      ))}
                    </div>
                  </TableCell>
                  <TableCell className="max-w-md align-top">
                    <p className="line-clamp-2 text-sm text-muted-foreground">
                      {t.content}
                    </p>
                  </TableCell>
                  <TableCell className="align-top">
                    <div className="flex flex-wrap gap-1">
                      {t.isFeatured && <Badge variant="outline">Featured</Badge>}
                      <Badge variant={t.isPublished ? "default" : "secondary"}>
                        {t.isPublished ? "Published" : "Draft"}
                      </Badge>
                    </div>
                  </TableCell>
                  <TableCell className="align-top text-right">
                    <TestimonialRowActions id={t.id} name={t.name} />
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
