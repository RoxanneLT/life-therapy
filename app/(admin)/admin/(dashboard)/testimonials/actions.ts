"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { testimonialSchema } from "@/lib/validations";
import { redirect } from "next/navigation";

export async function createTestimonial(formData: FormData) {
  const raw = Object.fromEntries(formData.entries());
  const parsed = testimonialSchema.parse({
    ...raw,
    isPublished: raw.isPublished === "true",
    isFeatured: raw.isFeatured === "true",
  });

  await prisma.testimonial.create({ data: parsed });

  revalidatePath("/admin/testimonials");
  revalidatePath("/");
  redirect("/admin/testimonials");
}

export async function updateTestimonial(id: string, formData: FormData) {
  const raw = Object.fromEntries(formData.entries());
  const parsed = testimonialSchema.parse({
    ...raw,
    isPublished: raw.isPublished === "true",
    isFeatured: raw.isFeatured === "true",
  });

  await prisma.testimonial.update({ where: { id }, data: parsed });

  revalidatePath("/admin/testimonials");
  revalidatePath("/");
  redirect("/admin/testimonials");
}

export async function deleteTestimonial(id: string) {
  await prisma.testimonial.delete({ where: { id } });

  revalidatePath("/admin/testimonials");
  revalidatePath("/");
}
