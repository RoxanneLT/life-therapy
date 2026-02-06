"use client";

import { TestimonialForm } from "@/components/admin/testimonial-form";
import { createTestimonial } from "../actions";

export default function NewTestimonialPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-bold">Add Testimonial</h1>
        <p className="text-sm text-muted-foreground">
          Add a new client testimonial.
        </p>
      </div>
      <TestimonialForm onSubmit={createTestimonial} />
    </div>
  );
}
