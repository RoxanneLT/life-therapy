import { prisma } from "@/lib/prisma";
import { getSiteSettings, getBusinessHours, formatBusinessHours } from "@/lib/settings";

const NAV_CONFIG: Record<string, { label: string; order: number }> = {
  home: { label: "Home", order: 0 },
  about: { label: "About", order: 1 },
  courses: { label: "Courses", order: 2 },
  sessions: { label: "Sessions", order: 3 },
  packages: { label: "Packages", order: 4 },
};

export async function getPublicLayoutData() {
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

  const showBookButton = publishedSlugs.has("book");

  const hours = getBusinessHours(settings);
  const formattedHours = formatBusinessHours(hours);

  const socialLinks = [
    settings.facebookUrl && { platform: "facebook" as const, url: settings.facebookUrl },
    settings.linkedinUrl && { platform: "linkedin" as const, url: settings.linkedinUrl },
    settings.instagramUrl && { platform: "instagram" as const, url: settings.instagramUrl },
    settings.tiktokUrl && { platform: "tiktok" as const, url: settings.tiktokUrl },
    settings.youtubeUrl && { platform: "youtube" as const, url: settings.youtubeUrl },
  ].filter(Boolean) as { platform: string; url: string }[];

  return { settings, navLinks, showBookButton, formattedHours, socialLinks };
}
