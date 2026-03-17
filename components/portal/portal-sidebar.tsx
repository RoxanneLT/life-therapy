"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  CalendarDays,
  GraduationCap,
  FileDown,
  ShoppingBag,
  Coins,
  Receipt,
  Settings,
  Menu,
} from "lucide-react";
import Image from "next/image";

const navItems = [
  { href: "/portal", label: "Dashboard", icon: LayoutDashboard },
  { href: "/portal/bookings", label: "My Sessions", icon: CalendarDays, sessionsOnly: true },
  { href: "/portal/courses", label: "My Courses", icon: GraduationCap },
  { href: "/portal/downloads", label: "Digital Products", icon: FileDown },
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
  const [manualCollapsed, setManualCollapsed] = useState(false);

  // Auto-collapse when inside a course learning page
  const autoCollapsed = pathname.startsWith("/portal/courses/") && pathname.includes("/learn");
  const collapsed = manualCollapsed || autoCollapsed;

  const filteredNavItems = navItems.filter(
    (item) => !item.sessionsOnly || isSessionsClient,
  );

  function isActive(href: string) {
    if (href === "/portal") return pathname === "/portal";
    return pathname.startsWith(href);
  }

  return (
    <aside className={cn("flex-shrink-0 border-r bg-card transition-all duration-200", collapsed ? "w-16" : "w-64", className)}>
      <div className="flex h-full flex-col">
        <div className={cn("flex h-16 items-center border-b", collapsed ? "justify-center px-2" : "justify-between px-4")}>
          {collapsed ? (
            <button
              type="button"
              onClick={() => setManualCollapsed(false)}
              className="flex h-9 w-9 items-center justify-center rounded-lg hover:bg-muted transition-colors"
              aria-label="Expand sidebar"
            >
              <Menu className="h-5 w-5 text-muted-foreground" />
            </button>
          ) : (
            <>
              <Link href="/portal">
                <Image
                  src="/logo.png"
                  alt="Life-Therapy"
                  width={200}
                  height={50}
                  className="h-10 w-auto"
                />
              </Link>
              <button
                type="button"
                onClick={() => setManualCollapsed(true)}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                aria-label="Collapse sidebar"
              >
                <Menu className="h-4 w-4" />
              </button>
            </>
          )}
        </div>

        <nav className="flex-1 space-y-1 p-2">
          {filteredNavItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              title={collapsed ? item.label : undefined}
              className={cn(
                "relative flex items-center rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                collapsed ? "justify-center gap-0" : "gap-3",
                isActive(item.href)
                  ? "bg-brand-50 text-brand-700 dark:bg-brand-950/30 dark:text-brand-300"
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
              {collapsed &&
                item.href === "/portal/bookings" &&
                isSessionsClient &&
                upcomingSessionCount != null &&
                upcomingSessionCount > 0 && (
                  <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-brand-600" />
                )}
            </Link>
          ))}
        </nav>
      </div>
    </aside>
  );
}
