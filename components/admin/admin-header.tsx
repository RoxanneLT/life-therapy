"use client";

import { useRouter, usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import { createBrowserClient } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Menu, LogOut, ExternalLink, UserCog } from "lucide-react";
import Link from "next/link";
import { AdminSidebarContent } from "./admin-sidebar";
import { ThemeToggle } from "@/components/theme-toggle";
import type { AdminRole } from "@/lib/generated/prisma/client";

interface AdminHeaderProps {
  readonly adminName?: string | null;
  readonly adminEmail?: string;
  readonly role: AdminRole;
}

export function AdminHeader({ adminName, adminEmail, role }: AdminHeaderProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [sheetOpen, setSheetOpen] = useState(false);

  // Close mobile sheet on navigation
  useEffect(() => {
    setSheetOpen(false);
  }, [pathname]);

  async function handleSignOut() {
    const supabase = createBrowserClient();
    await supabase.auth.signOut({ scope: "local" });
    // Clear ALL Supabase chunked auth cookies to prevent stale fragments
    document.cookie.split(";").forEach((c) => {
      const name = c.trim().split("=")[0];
      if (name.startsWith("sb-")) {
        document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/`;
      }
    });
    router.push("/login");
    router.refresh();
  }

  const initials = adminName
    ? adminName
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
    : "A";

  return (
    <header className="flex h-16 items-center justify-between border-b bg-card px-4 lg:px-6">
      {/* Mobile menu */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetTrigger asChild>
          <Button variant="ghost" size="icon" className="lg:hidden">
            <Menu className="h-5 w-5" />
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="w-64 p-0">
          <AdminSidebarContent role={role} onNavClick={() => setSheetOpen(false)} />
        </SheetContent>
      </Sheet>

      {/* Right side */}
      <div className="flex items-center gap-2">
        <ThemeToggle />
        <Button size="sm" className="bg-terracotta-500 text-white hover:bg-terracotta-600" asChild>
          <a href="/" target="_blank" rel="noopener noreferrer">
            <ExternalLink className="mr-1 h-3 w-3" />
            View Site
          </a>
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="rounded-full">
              <Avatar className="h-8 w-8">
                <AvatarFallback className="bg-brand-100 text-brand-700 text-xs">
                  {initials}
                </AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <div className="px-2 py-1.5">
              {adminName && (
                <p className="text-sm font-medium">{adminName}</p>
              )}
              {adminEmail && (
                <p className="text-xs text-muted-foreground">{adminEmail}</p>
              )}
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/admin/settings" className="flex items-center">
                <UserCog className="mr-2 h-4 w-4" />
                My Account
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleSignOut}>
              <LogOut className="mr-2 h-4 w-4" />
              Sign Out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
