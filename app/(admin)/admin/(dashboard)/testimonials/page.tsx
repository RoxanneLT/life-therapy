export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Plus, Pencil, Star } from "lucide-react";

export default async function AdminTestimonialsPage() {
  const testimonials = await prisma.testimonial.findMany({
    orderBy: { sortOrder: "asc" },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold">Testimonials</h1>
          <p className="text-sm text-muted-foreground">
            Manage client testimonials and reviews.
          </p>
        </div>
        <Button asChild>
          <Link href="/admin/testimonials/new">
            <Plus className="mr-2 h-4 w-4" />
            Add Testimonial
          </Link>
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {testimonials.map((testimonial) => (
          <Card key={testimonial.id}>
            <CardContent className="pt-6">
              <div className="mb-2 flex items-center justify-between">
                <div>
                  <p className="font-medium">{testimonial.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {testimonial.role}
                    {testimonial.location && ` — ${testimonial.location}`}
                  </p>
                </div>
                <div className="flex gap-1">
                  {testimonial.isFeatured && (
                    <Badge variant="outline">Featured</Badge>
                  )}
                  <Badge
                    variant={
                      testimonial.isPublished ? "default" : "secondary"
                    }
                  >
                    {testimonial.isPublished ? "Published" : "Draft"}
                  </Badge>
                </div>
              </div>
              <div className="mb-2 flex gap-0.5">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star
                    key={i}
                    className={`h-3 w-3 ${
                      i < testimonial.rating
                        ? "fill-yellow-400 text-yellow-400"
                        : "text-muted-foreground"
                    }`}
                  />
                ))}
              </div>
              <p className="line-clamp-3 text-sm text-muted-foreground">
                {testimonial.content}
              </p>
              <div className="mt-4">
                <Button variant="ghost" size="sm" asChild>
                  <Link href={`/admin/testimonials/${testimonial.id}`}>
                    <Pencil className="mr-1 h-3 w-3" />
                    Edit
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {testimonials.length === 0 && (
        <div className="rounded-lg border border-dashed p-12 text-center">
          <p className="text-muted-foreground">
            No testimonials yet. Add your first one.
          </p>
        </div>
      )}
    </div>
  );
}
