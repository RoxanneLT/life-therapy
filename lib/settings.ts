import { prisma } from "@/lib/prisma";
import type { SiteSetting } from "@/lib/generated/prisma/client";

export type SiteSettings = SiteSetting;

export interface BusinessHoursDay {
  open: string;
  close: string;
  closed: boolean;
}

export type BusinessHours = Record<string, BusinessHoursDay>;

const DEFAULT_BUSINESS_HOURS: BusinessHours = {
  monday: { open: "09:00", close: "17:00", closed: false },
  tuesday: { open: "09:00", close: "17:00", closed: false },
  wednesday: { open: "09:00", close: "17:00", closed: false },
  thursday: { open: "09:00", close: "17:00", closed: false },
  friday: { open: "09:00", close: "17:00", closed: false },
  saturday: { open: "09:00", close: "13:00", closed: true },
  sunday: { open: "09:00", close: "13:00", closed: true },
};

const DEFAULTS = {
  siteName: "Life-Therapy",
  tagline: "Online life coaching, counselling, and self-paced courses. Empowering you to build confidence and create meaningful change.",
  email: "hello@life-therapy.co.za",
  phone: "+27 71 017 0353",
  whatsappNumber: "27710170353",
  businessHours: DEFAULT_BUSINESS_HOURS,
  locationText: "100% Online — South Africa based, sessions via Microsoft Teams globally",
  facebookUrl: "https://facebook.com/lifetherapyza",
  linkedinUrl: "https://linkedin.com/in/roxanne-bouwer-03551820a",
  copyrightText: "\u00a92026 All rights reserved by Life Therapy PTY Ltd. Reg nr: 2019/570691/07.",
  footerTagline: "Online life coaching, counselling, and self-paced courses. Empowering you to build confidence and create meaningful change.",
} as const;

export async function getSiteSettings() {
  const settings = await prisma.siteSetting.findFirst();

  if (!settings) {
    return {
      id: "",
      ...DEFAULTS,
      logoUrl: null,
      instagramUrl: null,
      tiktokUrl: null,
      youtubeUrl: null,
      metaTitle: null,
      metaDescription: null,
      ogImageUrl: null,
      googleAnalyticsId: null,
      mailchimpApiKey: null,
      mailchimpAudienceId: null,
      mailchimpServer: null,
      smtpHost: null,
      smtpPort: null,
      smtpUser: null,
      smtpPass: null,
      smtpFromName: null,
      smtpFromEmail: null,
      bookingMaxAdvanceDays: 30,
      bookingMinNoticeHours: 24,
      bookingBufferMinutes: 15,
      bookingEnabled: false,
      msGraphTenantId: null,
      msGraphClientId: null,
      msGraphClientSecret: null,
      msGraphUserEmail: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as unknown as SiteSetting;
  }

  return settings;
}

export function getBusinessHours(settings: SiteSetting): BusinessHours {
  if (settings.businessHours && typeof settings.businessHours === "object") {
    return settings.businessHours as unknown as BusinessHours;
  }
  return DEFAULT_BUSINESS_HOURS;
}

export function formatBusinessHours(hours: BusinessHours): string {
  const days = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];
  const labels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  const lines: string[] = [];
  let i = 0;
  while (i < days.length) {
    const day = hours[days[i]];
    if (day.closed) {
      // Find consecutive closed days
      let j = i + 1;
      while (j < days.length && hours[days[j]].closed) j++;
      if (j - i > 1) {
        lines.push(`${labels[i]}–${labels[j - 1]}: Closed`);
      } else {
        lines.push(`${labels[i]}: Closed`);
      }
      i = j;
    } else {
      // Find consecutive days with same hours
      let j = i + 1;
      while (j < days.length && !hours[days[j]].closed && hours[days[j]].open === day.open && hours[days[j]].close === day.close) j++;
      if (j - i > 1) {
        lines.push(`${labels[i]}–${labels[j - 1]}: ${day.open} – ${day.close}`);
      } else {
        lines.push(`${labels[i]}: ${day.open} – ${day.close}`);
      }
      i = j;
    }
  }
  return lines.join("\n");
}
