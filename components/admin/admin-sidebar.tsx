"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  FileText,
  GraduationCap,
  Quote,
  CalendarDays,
  Settings,
  Users,
  ShoppingCart,
  Tag,
  Package,
  FileDown,
  Mail,
  Send,
  Timer,
  Receipt,
  BarChart3,
  Menu,
  ChevronLeft,
} from "lucide-react";
import Image from "next/image";
import { useState } from "react";
import type { AdminRole } from "@/lib/generated/prisma/client";
import { SETTINGS_CATALOG, SETTINGS_NAV_GROUPS } from "@/lib/settings-catalog";
import { canAccess } from "@/lib/admin-access";
import { useNavBadges } from "./use-nav-badges";
import { SIDEBAR_COLLAPSED_COOKIE } from "./sidebar-state";

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

const navGroups: NavGroup[] = [
  {
    label: "",
    items: [
      { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
      { href: "/admin/clients", label: "Clients", icon: Users },
      { href: "/admin/bookings", label: "Bookings", icon: CalendarDays },
    ],
  },
  {
    label: "Content",
    items: [
      { href: "/admin/pages", label: "Pages", icon: FileText },
      { href: "/admin/courses", label: "Courses", icon: GraduationCap },
      { href: "/admin/testimonials", label: "Testimonials", icon: Quote },
    ],
  },
  {
    label: "Finance",
    items: [
      // "Billing", not "Finance": Settings has its own Finance page (rates, VAT, terms), and two
      // menu entries with one name opened different pages.
      { href: "/admin/invoices", label: "Billing", icon: Receipt },
    ],
  },
  {
    label: "E-Commerce",
    items: [
      { href: "/admin/orders", label: "Orders", icon: ShoppingCart },
      { href: "/admin/coupons", label: "Coupons & Gifts", icon: Tag },
      { href: "/admin/packages", label: "Packages", icon: Package },
      { href: "/admin/digital-products", label: "Digital Products", icon: FileDown },
    ],
  },
  {
    label: "Communication",
    items: [
      { href: "/admin/campaigns", label: "Campaigns", icon: Send },
      { href: "/admin/drip-emails", label: "Drip Sequence", icon: Timer },
      { href: "/admin/email-templates", label: "Email Templates", icon: Mail },
    ],
  },
  {
    label: "Admin",
    items: [
      { href: "/admin/reports", label: "Reports", icon: BarChart3 },
      { href: "/admin/settings", label: "Settings", icon: Settings },
    ],
  },
];

/** Whether `role` sees the main-nav entry for `href`: the one table the keyboard shortcuts also read. */
/** The count pill beside an expanded item's label. Counts come from lib/dashboard-attention.ts. */
function NavCount({ count = 0 }: Readonly<{ count?: number }>) {
  if (count <= 0) return null;
  return (
    <span className="rounded-full bg-red-500 px-1.5 py-0.5 text-[10px] font-semibold leading-none text-white">
      {count > 99 ? "99+" : count}
    </span>
  );
}

/** An item's icon, with a dot on it when the sidebar is collapsed and the item has a count. */
function NavIconWithCount({
  icon: Icon,
  count = 0,
  collapsed,
}: Readonly<{ icon: React.ComponentType<{ className?: string }>; count?: number; collapsed: boolean }>) {
  return (
    <span className="relative shrink-0">
      <Icon className="h-4 w-4" />
      {collapsed && count > 0 && <span className="absolute -right-1 -top-1 h-2 w-2 rounded-full bg-red-500" />}
    </span>
  );
}

/** A collapsed item's tooltip carries its badge count, since the dot alone does not say how many. */
const withCount = (label: string, count = 0) => (count > 0 ? `${label} (${count})` : label);

interface SidebarContentProps {
  readonly role: AdminRole;
  readonly onNavClick?: () => void;
  readonly collapsed?: boolean;
  readonly onToggleCollapse?: () => void;
}

export function AdminSidebarContent({ role, onNavClick, collapsed = false, onToggleCollapse }: SidebarContentProps) {
  const pathname = usePathname();
  const badges = useNavBadges();

  function isActive(href: string) {
    if (href === "/admin") return pathname === "/admin";
    if (href === "/admin/settings") return pathname.startsWith("/admin/settings");
    return pathname.startsWith(href);
  }

  const visibleGroups = navGroups
    .map((group) => ({ ...group, items: group.items.filter((item) => canAccess(item.href, role)) }))
    .filter((group) => group.items.length > 0);

  // Inside Settings, the sidebar becomes the settings nav (with a back-to-dashboard
  // link). My Profile (/admin/account) and the Team user pages (/admin/users/*) are
  // part of the settings area, so they show the settings nav too.
  const inSettings =
    pathname.startsWith("/admin/settings") ||
    pathname.startsWith("/admin/account") ||
    pathname.startsWith("/admin/users");

  return (
    <div className="flex h-full flex-col bg-card text-card-foreground">
      {/* Logo / brand */}
      <div className={cn(
        "flex h-16 items-center border-b",
        collapsed ? "justify-center px-3" : "justify-between px-4"
      )}>
        {collapsed ? (
          <button
            type="button"
            onClick={onToggleCollapse}
            className="flex h-9 w-9 items-center justify-center rounded-lg hover:bg-muted transition-colors"
            aria-label="Expand sidebar"
          >
            <Menu className="h-5 w-5 text-muted-foreground" />
          </button>
        ) : (
          <>
            <Link href="/admin" onClick={onNavClick}>
              <Image
                src="/logo.png"
                alt="Life-Therapy"
                width={160}
                height={40}
                className="h-9 w-auto"
                priority
              />
            </Link>
            <button
              type="button"
              onClick={onToggleCollapse}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
              aria-label="Collapse sidebar"
            >
              <Menu className="h-4 w-4" />
            </button>
          </>
        )}
      </div>

      {/* Navigation — main nav, or the settings nav when inside /admin/settings */}
      <nav className="flex-1 overflow-y-auto p-2 py-4">
        {inSettings ? (
          <div className="space-y-4">
            {/* Back to dashboard — replaces the main nav while in settings */}
            <Link
              href="/admin"
              onClick={onNavClick}
              title={collapsed ? "Dashboard" : undefined}
              className={cn(
                "flex items-center rounded-lg py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
                collapsed ? "justify-center px-2" : "gap-2 px-3",
              )}
            >
              <ChevronLeft className="h-4 w-4 shrink-0" />
              {!collapsed && "Dashboard"}
            </Link>

            {!collapsed && (
              <h2 className="px-3 font-heading text-lg font-bold text-foreground">
                Settings
              </h2>
            )}

            <div className="space-y-0.5">
              <Link
                href="/admin/settings"
                onClick={onNavClick}
                title={collapsed ? "Overview" : undefined}
                className={cn(
                  "flex items-center rounded-lg py-2 text-sm font-medium transition-colors",
                  collapsed ? "justify-center px-2" : "gap-3 px-3",
                  pathname === "/admin/settings"
                    ? "bg-brand-50 text-brand-700"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                <Settings className="h-4 w-4 shrink-0" />
                {!collapsed && "Overview"}
              </Link>
            </div>

            {SETTINGS_NAV_GROUPS.map((group) => {
              const items = SETTINGS_CATALOG.filter((p) => p.group === group);
              if (items.length === 0) return null;
              return (
                <div key={group}>
                  {!collapsed && (
                    <p className="mb-1 px-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/60">
                      {group}
                    </p>
                  )}
                  <div className="space-y-0.5">
                    {items.map((item) => {
                      const Icon = item.icon;
                      const active =
                        pathname === item.href ||
                        pathname.startsWith(item.href + "/") ||
                        (item.prefixes ?? []).some(
                          (p) => pathname === p || pathname.startsWith(p + "/"),
                        );
                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          onClick={onNavClick}
                          title={collapsed ? withCount(item.title, badges[item.href]) : undefined}
                          className={cn(
                            "flex items-center rounded-lg py-2 text-sm font-medium transition-colors",
                            collapsed ? "justify-center px-2" : "gap-3 px-3",
                            active
                              ? "bg-brand-50 text-brand-700"
                              : "text-muted-foreground hover:bg-muted hover:text-foreground",
                          )}
                        >
                          <NavIconWithCount icon={Icon} count={badges[item.href]} collapsed={collapsed} />
                          {!collapsed && <span className="flex-1">{item.title}</span>}
                          {!collapsed && <NavCount count={badges[item.href]} />}
                        </Link>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          visibleGroups.map((group, groupIndex) => (
            <div key={group.label || "overview"} className="mb-4">
              {!collapsed && group.label && (
                <p className="mb-1 px-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/60">
                  {group.label}
                </p>
              )}
              {collapsed && groupIndex > 0 && <div className="my-2 border-t border-border/50" />}
              <div className="space-y-0.5">
                {group.items.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={onNavClick}
                    title={collapsed ? withCount(item.label, badges[item.href]) : undefined}
                    className={cn(
                      "flex items-center rounded-lg py-2 text-sm font-medium transition-colors",
                      collapsed ? "justify-center px-2" : "gap-3 px-3",
                      isActive(item.href)
                        ? "bg-brand-50 text-brand-700"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
                    )}
                  >
                    <NavIconWithCount icon={item.icon} count={badges[item.href]} collapsed={collapsed} />
                    {!collapsed && <span className="flex-1">{item.label}</span>}
                    {!collapsed && <NavCount count={badges[item.href]} />}
                  </Link>
                ))}
              </div>
            </div>
          ))
        )}
      </nav>
    </div>
  );
}

export function AdminSidebar({ role, defaultCollapsed = false }: { readonly role: AdminRole; readonly defaultCollapsed?: boolean }) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed);

  function toggle() {
    const next = !collapsed;
    setCollapsed(next);
    document.cookie = `${SIDEBAR_COLLAPSED_COOKIE}=${next ? "1" : "0"}; path=/admin; max-age=31536000; samesite=lax`;
  }

  return (
    <aside className={cn(
      "sticky top-0 hidden h-screen shrink-0 flex-col border-r lg:flex transition-all duration-200",
      collapsed ? "w-14" : "w-64"
    )}>
      <AdminSidebarContent
        role={role}
        collapsed={collapsed}
        onToggleCollapse={toggle}
      />
    </aside>
  );
}
