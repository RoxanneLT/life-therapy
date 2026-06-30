/**
 * lib/settings-catalog.ts — canonical list of admin Settings pages.
 *
 * Single source for the settings nav, the Overview cards, and visit matching.
 * Structure mirrors Pleks' settings catalog; styling stays Life-Therapy.
 */
import {
  Palette,
  Phone,
  Megaphone,
  Plug,
  Banknote,
  Users,
  FileText,
  MessageCircle,
  CalendarCheck,
  UserCog,
  type LucideIcon,
} from "lucide-react";

export interface SettingsPage {
  href: string;
  title: string;
  desc: string;
  icon: LucideIcon;
  group: string;
  /** sub-routes that count as a visit to this page */
  prefixes?: string[];
}

const BASE = "/admin/settings";

export const SETTINGS_CATALOG: SettingsPage[] = [
  { href: "/admin/account", title: "My Profile", desc: "Your profile, password & two-factor sign-in", icon: UserCog, group: "Account" },
  { href: `${BASE}/brand`, title: "Brand", desc: "Site identity, logo & footer", icon: Palette, group: "Website" },
  { href: `${BASE}/contact`, title: "Contact & Locations", desc: "Contact details, offices & hours", icon: Phone, group: "Website" },
  { href: `${BASE}/marketing`, title: "Marketing", desc: "Social links, SEO & newsletter", icon: Megaphone, group: "Website" },
  { href: `${BASE}/finance`, title: "Finance", desc: "Billing rates, VAT & payment terms", icon: Banknote, group: "Business" },
  { href: `${BASE}/team`, title: "Team", desc: "Admin users & roles", icon: Users, group: "Business", prefixes: ["/admin/users"] },
  { href: `${BASE}/legal`, title: "Legal Documents", desc: "Terms, privacy & commitment", icon: FileText, group: "Business" },
  { href: `${BASE}/integrations`, title: "Integrations", desc: "Email, payments & calendar connections", icon: Plug, group: "System" },
  { href: `${BASE}/whatsapp`, title: "WhatsApp", desc: "WhatsApp Business messaging", icon: MessageCircle, group: "System" },
  { href: `${BASE}/calendar-sync`, title: "Calendar Sync", desc: "Outlook / Teams reconciliation", icon: CalendarCheck, group: "System" },
];

/** Order of groups in the settings nav. */
export const SETTINGS_NAV_GROUPS = ["Account", "Website", "Business", "System"];

/** Top-N most-visited catalog hrefs (count > 0), most-visited first. */
export function topVisitedHrefs(pageVisits: Record<string, number>, n: number): string[] {
  return SETTINGS_CATALOG
    .map((p) => ({ href: p.href, count: pageVisits[p.href] ?? 0 }))
    .filter((x) => x.count > 0)
    .sort((a, b) => b.count - a.count)
    .slice(0, n)
    .map((x) => x.href);
}

/** The catalog page a pathname belongs to (exact, child route, or declared prefix) — longest match wins. */
export function matchSettingsPage(pathname: string): SettingsPage | null {
  let best: SettingsPage | null = null;
  let bestLen = -1;
  for (const p of SETTINGS_CATALOG) {
    for (const c of [p.href, ...(p.prefixes ?? [])]) {
      if ((pathname === c || pathname.startsWith(c + "/")) && c.length > bestLen) {
        best = p;
        bestLen = c.length;
      }
    }
  }
  return best;
}
