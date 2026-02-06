import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

export const pageSectionSchema = z.object({
  sectionType: z.enum([
    "hero",
    "text",
    "image_text",
    "cta",
    "testimonial_carousel",
    "course_grid",
    "features",
    "faq",
  ]),
  title: z.string().optional(),
  subtitle: z.string().optional(),
  content: z.string().optional(),
  imageUrl: z.string().optional(),
  imageAlt: z.string().optional(),
  ctaText: z.string().optional(),
  ctaLink: z.string().optional(),
  config: z.any().optional(),
  sortOrder: z.coerce.number().int().min(0).default(0),
  isVisible: z.boolean().default(true),
});

export const courseSchema = z.object({
  title: z.string().min(1, "Title is required"),
  slug: z.string().min(1, "Slug is required"),
  subtitle: z.string().optional(),
  shortDescription: z.string().optional(),
  description: z.string().optional(),
  imageUrl: z.string().optional(),
  price: z.coerce.number().int().min(0).default(0),
  category: z.string().optional(),
  modulesCount: z.coerce.number().int().min(0).default(0),
  hours: z.string().optional(),
  level: z.string().optional(),
  isPublished: z.boolean().default(false),
  isFeatured: z.boolean().default(false),
  sortOrder: z.coerce.number().int().default(0),
});

export const testimonialSchema = z.object({
  name: z.string().min(1, "Name is required"),
  role: z.string().optional(),
  location: z.string().optional(),
  content: z.string().min(1, "Content is required"),
  rating: z.coerce.number().int().min(1).max(5).default(5),
  imageUrl: z.string().optional(),
  serviceType: z.string().default("session"),
  isPublished: z.boolean().default(false),
  isFeatured: z.boolean().default(false),
  sortOrder: z.coerce.number().int().default(0),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type PageSectionInput = z.infer<typeof pageSectionSchema>;
export type CourseInput = z.infer<typeof courseSchema>;
export type TestimonialInput = z.infer<typeof testimonialSchema>;
