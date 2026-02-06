"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  GraduationCap,
  Award,
  Coins,
  CalendarDays,
  Settings,
} from "lucide-react";
import Image from "next/image";

const navItems = [
  { href: "/portal", label: "My Courses", icon: GraduationCap },
  { href: "/portal/certificates", label: "Certificates", icon: Award },
  { href: "/portal/credits", label: "Session Credits", icon: Coins },
  { href: "/portal/book", label: "Book a Session", icon: CalendarDays },
  { href: "/portal/settings", label: "Settings", icon: Settings },
];

interface PortalSidebarProps {
  readonly className?: string;
}

export function PortalSidebar({ className }: PortalSidebarProps) {
  const pathname = usePathname();

  function isActive(href: string) {
    if (href === "/portal")
      return pathname === "/portal" || pathname.startsWith("/portal/courses");
    return pathname.startsWith(href);
  }

  return (
    <aside className={cn("w-64 flex-shrink-0 border-r bg-card", className)}>
      <div className="flex h-full flex-col">
        <div className="flex h-16 items-center border-b px-6">
          <Image
            src="/logo.png"
            alt="Life-Therapy"
            width={200}
            height={50}
            className="h-10 w-auto"
          />
        </div>

        <nav className="flex-1 space-y-1 p-4">
          {navItems.map((item) => (
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
      </div>
    </aside>
  );
}
