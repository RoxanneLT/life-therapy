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
  Gift,
  Tag,
  Package,
  FileDown,
  Mail,
  Send,
  Timer,
  Receipt,
  Menu,
} from "lucide-react";
import Image from "next/image";
import { useState } from "react";
import type { AdminRole } from "@/lib/generated/prisma/client";

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  roles: AdminRole[];
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

const navGroups: NavGroup[] = [
  {
    label: "",
    items: [
      { href: "/admin", label: "Dashboard", icon: LayoutDashboard, roles: ["super_admin", "editor", "marketing"] },
      { href: "/admin/clients", label: "Clients", icon: Users, roles: ["super_admin", "marketing"] },
      { href: "/admin/bookings", label: "Bookings", icon: CalendarDays, roles: ["super_admin", "editor"] },
    ],
  },
  {
    label: "Content",
    items: [
      { href: "/admin/pages", label: "Pages", icon: FileText, roles: ["super_admin", "editor"] },
      { href: "/admin/courses", label: "Courses", icon: GraduationCap, roles: ["super_admin", "editor"] },
      { href: "/admin/testimonials", label: "Testimonials", icon: Quote, roles: ["super_admin", "editor", "marketing"] },
    ],
  },
  {
    label: "E-Commerce",
    items: [
      { href: "/admin/orders", label: "Orders", icon: ShoppingCart, roles: ["super_admin"] },
      { href: "/admin/invoices", label: "Invoices", icon: Receipt, roles: ["super_admin"] },
      { href: "/admin/gifts", label: "Gifts", icon: Gift, roles: ["super_admin"] },
      { href: "/admin/coupons", label: "Coupons", icon: Tag, roles: ["super_admin"] },
      { href: "/admin/packages", label: "Packages", icon: Package, roles: ["super_admin"] },
      { href: "/admin/digital-products", label: "Digital Products", icon: FileDown, roles: ["super_admin"] },
    ],
  },
  {
    label: "Communication",
    items: [
      { href: "/admin/campaigns", label: "Campaigns", icon: Send, roles: ["super_admin", "marketing"] },
      { href: "/admin/drip-emails", label: "Drip Sequence", icon: Timer, roles: ["super_admin", "marketing"] },
      { href: "/admin/email-templates", label: "Email Templates", icon: Mail, roles: ["super_admin"] },
    ],
  },
  {
    label: "Admin",
    items: [
      { href: "/admin/settings", label: "Settings", icon: Settings, roles: ["super_admin"] },
    ],
  },
];

interface SidebarContentProps {
  readonly role: AdminRole;
  readonly onNavClick?: () => void;
  readonly collapsed?: boolean;
  readonly onToggleCollapse?: () => void;
}

export function AdminSidebarContent({ role, onNavClick, collapsed = false, onToggleCollapse }: SidebarContentProps) {
  const pathname = usePathname();

  function isActive(href: string) {
    if (href === "/admin") return pathname === "/admin";
    if (href === "/admin/settings") return pathname.startsWith("/admin/settings");
    return pathname.startsWith(href);
  }

  const visibleGroups = navGroups
    .map((group) => ({ ...group, items: group.items.filter((item) => item.roles.includes(role)) }))
    .filter((group) => group.items.length > 0);

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

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto p-2 py-4">
        {visibleGroups.map((group, groupIndex) => (
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
                  title={collapsed ? item.label : undefined}
                  className={cn(
                    "flex items-center rounded-lg py-2 text-sm font-medium transition-colors",
                    collapsed ? "justify-center px-2" : "gap-3 px-3",
                    isActive(item.href)
                      ? "bg-brand-50 text-brand-700"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                >
                  <item.icon className="h-4 w-4 shrink-0" />
                  {!collapsed && item.label}
                </Link>
              ))}
            </div>
          </div>
        ))}
      </nav>
    </div>
  );
}

export function AdminSidebar({ role }: { readonly role: AdminRole }) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside className={cn(
      "sticky top-0 hidden h-screen shrink-0 flex-col border-r lg:flex transition-all duration-200",
      collapsed ? "w-14" : "w-64"
    )}>
      <AdminSidebarContent
        role={role}
        collapsed={collapsed}
        onToggleCollapse={() => setCollapsed((c) => !c)}
      />
    </aside>
  );
}
