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
} from "lucide-react";
import Image from "next/image";
import type { AdminRole } from "@/lib/generated/prisma/client";

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  roles: AdminRole[];
}

const navItems: NavItem[] = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard, roles: ["super_admin", "editor", "marketing"] },
  { href: "/admin/pages", label: "Pages", icon: FileText, roles: ["super_admin", "editor"] },
  { href: "/admin/courses", label: "Courses", icon: GraduationCap, roles: ["super_admin", "editor"] },
  { href: "/admin/testimonials", label: "Testimonials", icon: Quote, roles: ["super_admin", "editor", "marketing"] },
  { href: "/admin/bookings", label: "Bookings", icon: CalendarDays, roles: ["super_admin", "editor"] },
  { href: "/admin/users", label: "Users", icon: Users, roles: ["super_admin"] },
  { href: "/admin/settings", label: "Settings", icon: Settings, roles: ["super_admin"] },
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

  const visibleItems = navItems.filter((item) => item.roles.includes(role));

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
        <nav className="flex-1 space-y-1 p-4">
          {visibleItems.map((item) => (
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
        </nav>

        {/* Footer */}
        <div className="border-t p-4">
          <Link
            href="/"
            target="_blank"
            className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground"
          >
            View Public Site &rarr;
          </Link>
        </div>
      </div>
    </aside>
  );
}
