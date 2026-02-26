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
import { Menu, LogOut } from "lucide-react";
import { PortalSidebar } from "./portal-sidebar";
import { ThemeToggle } from "@/components/theme-toggle";

interface PortalHeaderProps {
  readonly studentName?: string | null;
  readonly studentEmail?: string;
  readonly upcomingSessionCount?: number;
  readonly isSessionsClient?: boolean;
}

export function PortalHeader({ studentName, studentEmail, upcomingSessionCount, isSessionsClient }: PortalHeaderProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [sheetOpen, setSheetOpen] = useState(false);

  // Close mobile sheet on navigation
  useEffect(() => {
    setSheetOpen(false);
  }, [pathname]);

  async function handleSignOut() {
    const supabase = createBrowserClient();
    await supabase.auth.signOut();
    router.push("/portal/login");
    router.refresh();
  }

  const initials = studentName
    ? studentName
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
    : "S";

  return (
    <header className="flex h-16 items-center justify-between border-b bg-card px-4 lg:px-6">
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetTrigger asChild>
          <Button variant="ghost" size="icon" className="lg:hidden">
            <Menu className="h-5 w-5" />
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="w-64 p-0">
          <PortalSidebar className="h-full" upcomingSessionCount={upcomingSessionCount} isSessionsClient={isSessionsClient} />
        </SheetContent>
      </Sheet>

      <div className="hidden lg:block">
        <h2 className="text-sm font-medium text-muted-foreground">
          Portal
        </h2>
      </div>

      <div className="flex items-center gap-2">
        <ThemeToggle />

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
              {studentName && (
                <p className="text-sm font-medium">{studentName}</p>
              )}
              {studentEmail && (
                <p className="text-xs text-muted-foreground">
                  {studentEmail}
                </p>
              )}
            </div>
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
