"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  CalendarDays,
  GraduationCap,
  ShoppingBag,
  Coins,
  Receipt,
  Settings,
} from "lucide-react";
import Image from "next/image";

const navItems = [
  { href: "/portal", label: "Dashboard", icon: LayoutDashboard },
  { href: "/portal/bookings", label: "My Sessions", icon: CalendarDays, sessionsOnly: true },
  { href: "/portal/courses", label: "My Courses", icon: GraduationCap },
  { href: "/portal/purchases", label: "My Purchases", icon: ShoppingBag },
  { href: "/portal/credits", label: "Credits", icon: Coins, sessionsOnly: true },
  { href: "/portal/invoices", label: "Invoices", icon: Receipt },
  { href: "/portal/settings", label: "Settings", icon: Settings },
];

interface PortalSidebarProps {
  readonly className?: string;
  readonly upcomingSessionCount?: number;
  readonly isSessionsClient?: boolean;
}

export function PortalSidebar({ className, upcomingSessionCount, isSessionsClient = true }: PortalSidebarProps) {
  const pathname = usePathname();

  // Auto-collapse to icon-only when inside a course
  const collapsed = pathname.startsWith("/portal/courses/") && pathname.includes("/learn");

  const filteredNavItems = navItems.filter(
    (item) => !item.sessionsOnly || isSessionsClient,
  );

  function isActive(href: string) {
    if (href === "/portal") return pathname === "/portal";
    return pathname.startsWith(href);
  }

  return (
    <aside className={cn("flex-shrink-0 border-r bg-card transition-all duration-300", collapsed ? "w-16" : "w-64", className)}>
      <div className="flex h-full flex-col">
        <div className={cn("flex h-16 items-center border-b", collapsed ? "justify-center px-2" : "px-6")}>
          {collapsed ? (
            <GraduationCap className="h-6 w-6 text-brand-600" />
          ) : (
            <Image
              src="/logo.png"
              alt="Life-Therapy"
              width={200}
              height={50}
              className="h-10 w-auto"
            />
          )}
        </div>

        <nav className="flex-1 space-y-1 p-2">
          {filteredNavItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              title={collapsed ? item.label : undefined}
              className={cn(
                "flex items-center rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                collapsed ? "justify-center gap-0" : "gap-3",
                isActive(item.href)
                  ? "bg-brand-50 text-brand-700"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <item.icon className="h-4 w-4 shrink-0" />
              {!collapsed && (
                <>
                  {item.label}
                  {item.href === "/portal/bookings" &&
                    isSessionsClient &&
                    upcomingSessionCount != null &&
                    upcomingSessionCount > 0 && (
                      <span className="ml-auto rounded-full bg-brand-600 px-1.5 py-0.5 text-[10px] font-semibold leading-none text-white">
                        {upcomingSessionCount}
                      </span>
                    )}
                </>
              )}
            </Link>
          ))}
        </nav>

        {!collapsed && (
          <div className="border-t p-4">
            <Link
              href="/"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground"
            >
              Visit Website &rarr;
            </Link>
          </div>
        )}
      </div>
    </aside>
  );
}
