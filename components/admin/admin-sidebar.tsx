"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  FileText,
  GraduationCap,
  Quote,
  Search,
  CalendarDays,
  Settings,
  Users,
  ShoppingCart,
  Gift,
  Tag,
  UserCheck,
  Package,
  FileDown,
  Mail,
  Send,
  Contact,
  Timer,
} from "lucide-react";
import Image from "next/image";
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
    ],
  },
  {
    label: "Content",
    items: [
      { href: "/admin/pages", label: "Pages", icon: FileText, roles: ["super_admin", "editor"] },
      { href: "/admin/courses", label: "Courses", icon: GraduationCap, roles: ["super_admin", "editor"] },
      { href: "/admin/testimonials", label: "Testimonials", icon: Quote, roles: ["super_admin", "editor", "marketing"] },
      { href: "/admin/seo", label: "SEO", icon: Search, roles: ["super_admin", "editor"] },
    ],
  },
  {
    label: "Bookings",
    items: [
      { href: "/admin/bookings", label: "Bookings", icon: CalendarDays, roles: ["super_admin", "editor"] },
    ],
  },
  {
    label: "E-Commerce",
    items: [
      { href: "/admin/orders", label: "Orders", icon: ShoppingCart, roles: ["super_admin"] },
      { href: "/admin/gifts", label: "Gifts", icon: Gift, roles: ["super_admin"] },
      { href: "/admin/coupons", label: "Coupons", icon: Tag, roles: ["super_admin"] },
      { href: "/admin/packages", label: "Packages", icon: Package, roles: ["super_admin"] },
      { href: "/admin/digital-products", label: "Digital Products", icon: FileDown, roles: ["super_admin"] },
    ],
  },
  {
    label: "Communication",
    items: [
      { href: "/admin/contacts", label: "Contacts", icon: Contact, roles: ["super_admin", "marketing"] },
      { href: "/admin/campaigns", label: "Campaigns", icon: Send, roles: ["super_admin", "marketing"] },
      { href: "/admin/drip-emails", label: "Drip Sequence", icon: Timer, roles: ["super_admin", "marketing"] },
      { href: "/admin/email-templates", label: "Email Templates", icon: Mail, roles: ["super_admin"] },
    ],
  },
  {
    label: "Admin",
    items: [
      { href: "/admin/students", label: "Students", icon: UserCheck, roles: ["super_admin"] },
      { href: "/admin/users", label: "Users", icon: Users, roles: ["super_admin"] },
      { href: "/admin/settings", label: "Settings", icon: Settings, roles: ["super_admin"] },
    ],
  },
];

interface AdminSidebarProps {
  readonly className?: string;
  readonly role: AdminRole;
}

export function AdminSidebar({ className, role }: AdminSidebarProps) {
  const pathname = usePathname();

  function isActive(href: string) {
    if (href === "/admin") return pathname === "/admin";
    return pathname.startsWith(href);
  }

  // Filter groups to only show items visible to the current role
  const visibleGroups = navGroups
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => item.roles.includes(role)),
    }))
    .filter((group) => group.items.length > 0);

  return (
    <aside className={cn("w-64 flex-shrink-0 border-r bg-card", className)}>
      <div className="flex h-full flex-col">
        {/* Logo */}
        <div className="flex h-16 items-center border-b px-6">
          <Image
            src="/logo.png"
            alt="Life-Therapy"
            width={200}
            height={50}
            className="h-10 w-auto"
          />
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto p-4">
          {visibleGroups.map((group, groupIndex) => (
            <div key={group.label || "overview"} className={groupIndex > 0 ? "mt-4" : ""}>
              {group.label && (
                <p className="mb-1 px-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/60">
                  {group.label}
                </p>
              )}
              <div className="space-y-0.5">
                {group.items.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                      isActive(item.href)
                        ? "bg-brand-50 text-brand-700"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
                    )}
                  >
                    <item.icon className="h-4 w-4" />
                    {item.label}
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </nav>

        {/* Footer */}
        <div className="border-t p-4">
          <Link
            href="/"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground"
          >
            View Public Site &rarr;
          </Link>
        </div>
      </div>
    </aside>
  );
}
