import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(12, "Password must be at least 12 characters"),
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

export const siteSettingsSchema = z.object({
  // Branding
  siteName: z.string().min(1, "Site name is required"),
  tagline: z.string().optional(),
  logoUrl: z.string().optional(),
  // Contact
  email: z.string().email().optional().or(z.literal("")),
  phone: z.string().optional(),
  whatsappNumber: z.string().optional(),
  businessHours: z.any().optional(),
  locationText: z.string().optional(),
  // Social Links
  facebookUrl: z.string().url().optional().or(z.literal("")),
  linkedinUrl: z.string().url().optional().or(z.literal("")),
  instagramUrl: z.string().url().optional().or(z.literal("")),
  tiktokUrl: z.string().url().optional().or(z.literal("")),
  youtubeUrl: z.string().url().optional().or(z.literal("")),
  // SEO
  metaTitle: z.string().optional(),
  metaDescription: z.string().optional(),
  ogImageUrl: z.string().optional(),
  googleAnalyticsId: z.string().optional(),
  // Newsletter (Mailchimp)
  mailchimpApiKey: z.string().optional(),
  mailchimpAudienceId: z.string().optional(),
  mailchimpServer: z.string().optional(),
  // Email (SMTP)
  smtpHost: z.string().optional(),
  smtpPort: z.coerce.number().int().optional().or(z.literal("")),
  smtpUser: z.string().optional(),
  smtpPass: z.string().optional(),
  smtpFromName: z.string().optional(),
  smtpFromEmail: z.string().email().optional().or(z.literal("")),
  // Footer
  copyrightText: z.string().optional(),
  footerTagline: z.string().optional(),
});

export const bookingFormSchema = z.object({
  sessionType: z.enum(["free_consultation", "individual", "couples"]),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
  clientName: z.string().min(2, "Name is required"),
  clientEmail: z.string().email("Valid email is required"),
  clientPhone: z.string().optional(),
  clientNotes: z.string().max(1000).optional(),
});

export const availabilityOverrideSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  isBlocked: z.boolean(),
  startTime: z.string().regex(/^\d{2}:\d{2}$/).optional().or(z.literal("")),
  endTime: z.string().regex(/^\d{2}:\d{2}$/).optional().or(z.literal("")),
  reason: z.string().max(200).optional(),
});

export const bookingSettingsSchema = z.object({
  bookingMaxAdvanceDays: z.coerce.number().int().min(1).max(365).default(30),
  bookingMinNoticeHours: z.coerce.number().int().min(0).max(168).default(24),
  bookingBufferMinutes: z.coerce.number().int().min(0).max(120).default(15),
  bookingEnabled: z.boolean().default(false),
  msGraphTenantId: z.string().optional().or(z.literal("")),
  msGraphClientId: z.string().optional().or(z.literal("")),
  msGraphClientSecret: z.string().optional().or(z.literal("")),
  msGraphUserEmail: z.string().email().optional().or(z.literal("")),
});

// ============================================================
// LMS: Module / Lecture / Quiz
// ============================================================
export const moduleSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
  sortOrder: z.coerce.number().int().min(0).default(0),
});

export const lectureSchema = z.object({
  title: z.string().min(1, "Title is required"),
  lectureType: z.enum(["video", "text", "quiz"]),
  videoUrl: z.string().optional().or(z.literal("")),
  textContent: z.string().optional(),
  worksheetUrl: z.string().optional().or(z.literal("")),
  durationSeconds: z.coerce.number().int().min(0).optional(),
  isPreview: z.boolean().default(false),
  sortOrder: z.coerce.number().int().min(0).default(0),
});

export const quizQuestionSchema = z.object({
  questionType: z.enum(["multiple_choice", "true_false", "reflection"]),
  questionText: z.string().min(1, "Question text is required"),
  options: z.any().optional(),
  explanation: z.string().optional(),
  sortOrder: z.coerce.number().int().min(0).default(0),
});

// ============================================================
// E-Commerce: Coupons / Credit Packs
// ============================================================
export const couponSchema = z.object({
  code: z.string().min(1, "Code is required").transform((v) => v.toUpperCase()),
  type: z.enum(["percentage", "fixed_amount"]),
  value: z.coerce.number().int().min(1, "Value must be at least 1"),
  appliesToAll: z.boolean().default(true),
  courseIds: z.any().optional(),
  bundleIds: z.any().optional(),
  maxUses: z.coerce.number().int().min(1).optional().or(z.literal("")),
  maxUsesPerUser: z.coerce.number().int().min(1).default(1),
  minOrderCents: z.coerce.number().int().min(0).optional().or(z.literal("")),
  startsAt: z.string().optional(),
  expiresAt: z.string().optional().or(z.literal("")),
  isActive: z.boolean().default(true),
});

export const creditPackSchema = z.object({
  name: z.string().min(1, "Name is required"),
  credits: z.coerce.number().int().min(1, "Must offer at least 1 credit"),
  priceCents: z.coerce.number().int().min(0),
  isPublished: z.boolean().default(true),
  sortOrder: z.coerce.number().int().default(0),
});

export const packageSchema = z.object({
  title: z.string().min(1, "Title is required"),
  slug: z.string().min(1, "Slug is required"),
  description: z.string().optional(),
  imageUrl: z.string().optional(),
  priceCents: z.coerce.number().int().min(0, "Price is required"),
  credits: z.coerce.number().int().min(0).default(0),
  documentUrl: z.string().optional().or(z.literal("")),
  isPublished: z.boolean().default(false),
  sortOrder: z.coerce.number().int().default(0),
});

// ============================================================
// Student Registration
// ============================================================
export const studentRegisterSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  email: z.string().email("Valid email is required"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

export const studentLoginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
});

// ============================================================
// Type exports
// ============================================================
export type LoginInput = z.infer<typeof loginSchema>;
export type PageSectionInput = z.infer<typeof pageSectionSchema>;
export type CourseInput = z.infer<typeof courseSchema>;
export type TestimonialInput = z.infer<typeof testimonialSchema>;
export type SiteSettingsInput = z.infer<typeof siteSettingsSchema>;
export type BookingFormInput = z.infer<typeof bookingFormSchema>;
export type AvailabilityOverrideInput = z.infer<typeof availabilityOverrideSchema>;
export type BookingSettingsInput = z.infer<typeof bookingSettingsSchema>;
export type ModuleInput = z.infer<typeof moduleSchema>;
export type LectureInput = z.infer<typeof lectureSchema>;
export type QuizQuestionInput = z.infer<typeof quizQuestionSchema>;
export type CouponInput = z.infer<typeof couponSchema>;
export type CreditPackInput = z.infer<typeof creditPackSchema>;
export type PackageInput = z.infer<typeof packageSchema>;
export type StudentRegisterInput = z.infer<typeof studentRegisterSchema>;
export type StudentLoginInput = z.infer<typeof studentLoginSchema>;
