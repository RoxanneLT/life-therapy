"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { testimonialSchema } from "@/lib/validations";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth";

export async function createTestimonial(formData: FormData) {
  await requireRole("super_admin", "editor", "marketing");
  const raw = Object.fromEntries(formData.entries());
  const parsed = testimonialSchema.parse({
    ...raw,
    isPublished: raw.isPublished === "true",
    isFeatured: raw.isFeatured === "true",
  });

  try {
    await prisma.testimonial.create({ data: parsed });
  } catch (err) {
    console.error("[create-testimonial]", err);
    throw new Error("Failed to create testimonial. Please try again.");
  }

  revalidatePath("/admin/testimonials");
  revalidatePath("/");
  redirect("/admin/testimonials");
}

export async function updateTestimonial(id: string, formData: FormData) {
  await requireRole("super_admin", "editor", "marketing");
  const raw = Object.fromEntries(formData.entries());
  const parsed = testimonialSchema.parse({
    ...raw,
    isPublished: raw.isPublished === "true",
    isFeatured: raw.isFeatured === "true",
  });

  try {
    await prisma.testimonial.update({ where: { id }, data: parsed });
  } catch (err) {
    console.error("[update-testimonial]", err);
    throw new Error("Failed to update testimonial. Please try again.");
  }

  revalidatePath("/admin/testimonials");
  revalidatePath("/");
  redirect("/admin/testimonials");
}

export async function deleteTestimonial(id: string) {
  await requireRole("super_admin", "editor", "marketing");
  try {
    await prisma.testimonial.delete({ where: { id } });
  } catch (err) {
    console.error("[delete-testimonial]", err);
    throw new Error("Failed to delete testimonial. Please try again.");
  }

  revalidatePath("/admin/testimonials");
  revalidatePath("/");
}
