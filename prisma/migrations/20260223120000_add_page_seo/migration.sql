-- CreateTable
CREATE TABLE "page_seo" (
    "id" TEXT NOT NULL,
    "route" TEXT NOT NULL,
    "metaTitle" TEXT,
    "metaDescription" TEXT,
    "ogImageUrl" TEXT,
    "keywords" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "page_seo_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "page_seo_route_key" ON "page_seo"("route");

-- Add SEO fields to courses
ALTER TABLE "courses" ADD COLUMN "metaTitle" TEXT;
ALTER TABLE "courses" ADD COLUMN "metaDescription" TEXT;

-- Add SEO fields to hybrid_packages
ALTER TABLE "hybrid_packages" ADD COLUMN "metaTitle" TEXT;
ALTER TABLE "hybrid_packages" ADD COLUMN "metaDescription" TEXT;

-- Add SEO fields to digital_products
ALTER TABLE "digital_products" ADD COLUMN "metaTitle" TEXT;
ALTER TABLE "digital_products" ADD COLUMN "metaDescription" TEXT;

-- Seed default PageSeo rows for all static routes
INSERT INTO "page_seo" ("id", "route", "metaTitle", "metaDescription", "ogImageUrl", "updatedAt") VALUES
  (gen_random_uuid()::text, '/', 'Life-Therapy | Personal Development & Life Coaching', 'Transform your life with Roxanne Bouwer. Qualified life coach, counsellor & NLP practitioner offering online courses and 1:1 sessions.', '/images/hero-home.jpg', NOW()),
  (gen_random_uuid()::text, '/about', 'About Roxanne Bouwer', 'Meet Roxanne Bouwer — qualified life coach, counsellor, and NLP practitioner helping you build confidence and create meaningful change.', '/images/roxanne-portrait.jpg', NOW()),
  (gen_random_uuid()::text, '/sessions', '1:1 Online Sessions', 'Personalised online life coaching and counselling sessions with Roxanne Bouwer. Secure video calls from anywhere in the world.', '/images/hero-sessions.jpg', NOW()),
  (gen_random_uuid()::text, '/courses', 'Online Courses', 'Self-paced online courses covering self-esteem, confidence, anxiety, relationships, and more. Expert-designed by Roxanne Bouwer.', '/images/hero-courses.jpg', NOW()),
  (gen_random_uuid()::text, '/packages', 'Bundles & Packages', 'Get more value with curated course bundles. Combine self-paced learning for the ultimate personal growth experience.', '/images/hero-packages.jpg', NOW()),
  (gen_random_uuid()::text, '/products', 'Digital Products', 'Downloadable workbooks, toolkits, and guides to support your personal growth journey.', '/images/hero-home.jpg', NOW()),
  (gen_random_uuid()::text, '/book', 'Book a Session', 'Book a free consultation or schedule a 1:1 coaching session with Roxanne Bouwer.', '/images/hero-book.jpg', NOW()),
  (gen_random_uuid()::text, '/contact', 'Contact', 'Get in touch with Life-Therapy. Reach out via email, WhatsApp, or book a free consultation.', '/images/hero-contact.jpg', NOW());
