"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { AdminRole } from "@/lib/generated/prisma/client";
import { canAccess } from "@/lib/admin-access";

/** G, then a letter, goes to a page. Only pages the role can open are bound (canAccess). */
const GO_TO: { key: string; href: string; label: string }[] = [
  { key: "d", href: "/admin", label: "Dashboard" },
  { key: "c", href: "/admin/clients", label: "Clients" },
  { key: "b", href: "/admin/bookings", label: "Bookings" },
  { key: "i", href: "/admin/invoices", label: "Billing" },
  { key: "o", href: "/admin/orders", label: "Orders" },
  { key: "p", href: "/admin/pages", label: "Pages" },
  { key: "m", href: "/admin/campaigns", label: "Campaigns" },
  { key: "r", href: "/admin/reports", label: "Reports" },
  { key: "s", href: "/admin/settings", label: "Settings" },
];

const SEQUENCE_MS = 1500;

/** A keystroke meant for a field, or one carrying a modifier, is never a shortcut. */
function isTyping(e: KeyboardEvent) {
  if (e.metaKey || e.ctrlKey || e.altKey) return true;
  const el = e.target as HTMLElement | null;
  if (!el) return false;
  return el.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName);
}

export function AdminShortcuts({ role }: { readonly role: AdminRole }) {
  const router = useRouter();
  const [helpOpen, setHelpOpen] = useState(false);
  const pendingG = useRef(0);
  const bindings = useMemo(() => GO_TO.filter((b) => canAccess(b.href, role)), [role]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (isTyping(e)) return;
      if (e.key === "?") {
        e.preventDefault();
        setHelpOpen((o) => !o);
        return;
      }
      const key = e.key.toLowerCase();
      if (Date.now() - pendingG.current < SEQUENCE_MS) {
        pendingG.current = 0;
        const hit = bindings.find((b) => b.key === key);
        if (hit) {
          e.preventDefault();
          setHelpOpen(false);
          router.push(hit.href);
        }
        return;
      }
      if (key === "g") pendingG.current = Date.now();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [bindings, router]);

  return (
    <Dialog open={helpOpen} onOpenChange={setHelpOpen}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Keyboard shortcuts</DialogTitle>
        </DialogHeader>
        <dl className="grid grid-cols-[auto_1fr] items-center gap-x-4 gap-y-2 text-sm">
          <Row keys={["Ctrl", "K"]} label="Search" />
          {bindings.map((b) => (
            <Row key={b.key} keys={["G", b.key.toUpperCase()]} label={b.label} />
          ))}
          <Row keys={["?"]} label="This list" />
        </dl>
      </DialogContent>
    </Dialog>
  );
}

function Row({ keys, label }: { readonly keys: string[]; readonly label: string }) {
  return (
    <>
      <Keys keys={keys} />
      <dd>{label}</dd>
    </>
  );
}

function Keys({ keys }: { readonly keys: string[] }) {
  return (
    <dt className="flex gap-1">
      {keys.map((k) => (
        <kbd key={k} className="rounded border bg-muted px-1.5 py-0.5 font-mono text-xs text-muted-foreground">
          {k}
        </kbd>
      ))}
    </dt>
  );
}
