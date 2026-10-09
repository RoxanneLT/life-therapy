/**
 * Which admin roles may open which admin page: the one map. The sidebar, the G-shortcuts, the
 * dashboard's attention rows, the header search and every admin page's own guard read it.
 *
 * Until 2026-10-09 the same lists were written out in five places (the sidebar's `roles`, two
 * copies of BOOKINGS/CLIENTS/SUPER, and ~40 page-level `requireRole` literals), and three areas
 * (courses, pages, email-templates) had no page guard at all — any signed-in admin could open them
 * by URL while the sidebar hid them. The audit (`admin-access: every admin page is guarded by its
 * area`) now holds every page.tsx to this map.
 *
 * Server actions are not covered: a mutating action's guard follows its own rule (CLAUDE.md §4).
 */
import type { AdminRole } from "@/lib/generated/prisma/client";

const ALL: readonly AdminRole[] = ["super_admin", "editor", "marketing"];
const SUPER: readonly AdminRole[] = ["super_admin"];

/**
 * Keyed by route. A route is governed by its longest matching key, where a key matches itself and
 * everything below it — except "/admin", which matches the dashboard alone. A route no key matches
 * is super_admin only, so a page added without an entry fails closed.
 */
export const ADMIN_ACCESS = {
  "/admin": ALL,
  "/admin/account": ALL,
  "/admin/users/change-password": ALL,

  "/admin/clients": ["super_admin", "marketing"],
  "/admin/students": ["super_admin", "marketing"], // redirects to /admin/clients
  "/admin/bookings": ["super_admin", "editor"],
  "/admin/bookings/availability": SUPER,
  "/admin/bookings/settings": SUPER,

  "/admin/pages": ["super_admin", "editor"],
  "/admin/seo": ["super_admin", "editor"],
  "/admin/courses": ["super_admin", "editor"],
  "/admin/testimonials": ALL,

  "/admin/invoices": SUPER,
  "/admin/orders": SUPER,
  "/admin/coupons": SUPER,
  "/admin/gifts": SUPER, // redirects to /admin/coupons
  "/admin/packages": SUPER,
  "/admin/digital-products": SUPER,

  "/admin/campaigns": ["super_admin", "marketing"],
  "/admin/drip-emails": ["super_admin", "marketing"],
  "/admin/email-templates": SUPER,

  "/admin/reports": SUPER,
  "/admin/settings": SUPER,
  "/admin/users": SUPER, // redirects to /admin/settings/team
  "/admin/legal-documents": SUPER, // redirects to /admin/settings/legal
} as const satisfies Record<string, readonly AdminRole[]>;

export type AdminArea = keyof typeof ADMIN_ACCESS;

/** The key that governs a route (query string ignored), or null when none does. */
function accessKeyFor(href: string): AdminArea | null {
  const route = href.split(/[?#]/)[0].replace(/\/$/, "") || "/";
  let best: AdminArea | null = null;
  for (const key of Object.keys(ADMIN_ACCESS) as AdminArea[]) {
    const matches = key === "/admin" ? route === key : route === key || route.startsWith(key + "/");
    if (matches && (!best || key.length > best.length)) best = key;
  }
  return best;
}

function rolesFor(href: string): readonly AdminRole[] {
  const key = accessKeyFor(href);
  return key ? ADMIN_ACCESS[key] : SUPER;
}

export function canAccess(href: string, role: AdminRole): boolean {
  return rolesFor(href).includes(role);
}
