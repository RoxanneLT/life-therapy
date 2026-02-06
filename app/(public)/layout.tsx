import { prisma } from "@/lib/prisma";
import { getSiteSettings, getBusinessHours, formatBusinessHours } from "@/lib/settings";
import { PublicHeader } from "@/components/public/header";
import { PublicFooter } from "@/components/public/footer";
import { WhatsAppButton } from "@/components/public/whatsapp-button";
import { CookieConsent } from "@/components/public/cookie-consent";

// Map page slugs to nav labels and order
const NAV_CONFIG: Record<string, { label: string; order: number }> = {
  home: { label: "Home", order: 0 },
  about: { label: "About", order: 1 },
  courses: { label: "Courses", order: 2 },
  sessions: { label: "Sessions", order: 3 },
  packages: { label: "Packages", order: 4 },
};

export default async function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [pages, settings] = await Promise.all([
    prisma.page.findMany({
      where: { isPublished: true },
      select: { slug: true },
    }),
    getSiteSettings(),
  ]);

  const publishedSlugs = new Set(pages.map((p) => p.slug));

  const navLinks = Object.entries(NAV_CONFIG)
    .filter(([slug]) => publishedSlugs.has(slug))
    .sort(([, a], [, b]) => a.order - b.order)
    .map(([slug, config]) => ({
      href: slug === "home" ? "/" : `/${slug}`,
      label: config.label,
    }));

  // "Book a Session" button shown only if book page is published
  const showBookButton = publishedSlugs.has("book");

  const hours = getBusinessHours(settings);
  const formattedHours = formatBusinessHours(hours);

  // Build social links array (only include non-empty)
  const socialLinks = [
    settings.facebookUrl && { platform: "facebook" as const, url: settings.facebookUrl },
    settings.linkedinUrl && { platform: "linkedin" as const, url: settings.linkedinUrl },
    settings.instagramUrl && { platform: "instagram" as const, url: settings.instagramUrl },
    settings.tiktokUrl && { platform: "tiktok" as const, url: settings.tiktokUrl },
    settings.youtubeUrl && { platform: "youtube" as const, url: settings.youtubeUrl },
  ].filter(Boolean) as { platform: string; url: string }[];

  return (
    <>
      <PublicHeader
        navLinks={navLinks}
        showBookButton={showBookButton}
        logoUrl={settings.logoUrl}
      />
      <main className="min-h-[calc(100vh-4rem)]">{children}</main>
      <PublicFooter
        tagline={settings.footerTagline || settings.tagline || ""}
        logoUrl={settings.logoUrl}
        email={settings.email || ""}
        phone={settings.phone || ""}
        whatsappNumber={settings.whatsappNumber || ""}
        businessHours={formattedHours}
        locationText={settings.locationText || ""}
        socialLinks={socialLinks}
        copyrightText={settings.copyrightText || ""}
        mailchimpConfigured={!!(settings.mailchimpApiKey && settings.mailchimpAudienceId && settings.mailchimpServer)}
      />
      <WhatsAppButton whatsappNumber={settings.whatsappNumber || "27710170353"} />
      <CookieConsent />
    </>
  );
}
