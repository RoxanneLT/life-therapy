"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Menu, User } from "lucide-react";
import Image from "next/image";
import { ThemeToggle } from "@/components/theme-toggle";
import { CartBadge } from "@/components/public/cart/cart-badge";

interface NavLink {
  href: string;
  label: string;
}

interface PublicHeaderProps {
  navLinks: NavLink[];
  showBookButton: boolean;
  logoUrl?: string | null;
}

export function PublicHeader({ navLinks, showBookButton, logoUrl }: PublicHeaderProps) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b bg-background/80 backdrop-blur-sm">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
        {/* Logo */}
        <Link href="/" className="flex items-center">
          <Image
            src={logoUrl || "/logo.png"}
            alt="Life-Therapy"
            width={200}
            height={50}
            className="h-10 w-auto"
            priority
          />
        </Link>

        {/* Desktop nav */}
        <nav className="hidden items-center gap-1 md:flex">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                "rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                pathname === link.href
                  ? "text-brand-600"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {link.label}
            </Link>
          ))}
          {showBookButton && (
            <Button size="sm" className="ml-2" asChild>
              <Link href="/book">Book a Session</Link>
            </Button>
          )}
          <ThemeToggle />
          <CartBadge />
          <Button variant="outline" size="sm" className="gap-1.5" asChild>
            <Link href="/portal/login">
              <User className="h-3.5 w-3.5" />
              Portal
            </Link>
          </Button>
        </nav>

        {/* Mobile menu */}
        <div className="flex items-center gap-1 md:hidden">
          <CartBadge />
          <ThemeToggle />
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
          <SheetContent side="right" className="w-64">
            <nav className="mt-8 flex flex-col gap-2">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setOpen(false)}
                  className={cn(
                    "rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                    pathname === link.href
                      ? "bg-brand-50 text-brand-600"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {link.label}
                </Link>
              ))}
              {showBookButton && (
                <Button className="mt-4" asChild>
                  <Link href="/book" onClick={() => setOpen(false)}>
                    Book a Session
                  </Link>
                </Button>
              )}
              <Button variant="outline" size="sm" className="mt-2 gap-1.5" asChild>
                <Link href="/portal/login" onClick={() => setOpen(false)}>
                  <User className="h-3.5 w-3.5" />
                  Student Portal
                </Link>
              </Button>
            </nav>
          </SheetContent>
        </Sheet>
        </div>
      </div>
    </header>
  );
}
