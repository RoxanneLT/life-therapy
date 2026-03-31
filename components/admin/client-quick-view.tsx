"use client";

import { useState, useEffect, useRef } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { User, ArrowRight } from "lucide-react";
import Link from "next/link";

interface ClientQuickViewProps {
  readonly studentId: string;
  readonly children: React.ReactNode;
}

interface QuickViewData {
  firstName: string;
  lastName: string;
  email: string;
  clientStatus: string;
  billingType: string;
  nextSession: string | null;
  creditBalance: number;
  lastSession: string | null;
}

export function ClientQuickView({ studentId, children }: ClientQuickViewProps) {
  const [data, setData] = useState<QuickViewData | null>(null);
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open && !data) {
      fetch("/api/admin/client-quick-view?id=" + studentId)
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => setData(d))
        .catch(() => {});
    }
  }, [open, studentId, data]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  return (
    <div ref={wrapperRef} className="relative inline-block">
      <span
        className="cursor-pointer hover:text-brand-600 hover:underline"
        onClick={() => setOpen(!open)}
      >
        {children}
      </span>
      {open && (
        <div className="absolute left-0 top-full z-50 mt-1 w-72 rounded-md border bg-popover p-3 shadow-lg">
          {!data ? (
            <p className="text-xs text-muted-foreground">Loading...</p>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-100 dark:bg-brand-900/40">
                  <User className="h-4 w-4 text-brand-700 dark:text-brand-300" />
                </div>
                <div>
                  <p className="text-sm font-medium">{data.firstName} {data.lastName}</p>
                  <p className="text-xs text-muted-foreground">{data.email}</p>
                </div>
              </div>
              <div className="flex gap-2">
                <Badge variant="outline" className="text-[10px] capitalize">{data.clientStatus}</Badge>
                <Badge variant="outline" className="text-[10px] capitalize">{data.billingType}</Badge>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <p className="text-muted-foreground">Next Session</p>
                  <p className="font-medium">{data.nextSession || "None"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Credits</p>
                  <p className="font-medium">{data.creditBalance}</p>
                </div>
                <div className="col-span-2">
                  <p className="text-muted-foreground">Last Session</p>
                  <p className="font-medium">{data.lastSession || "None"}</p>
                </div>
              </div>
              <Button asChild size="sm" variant="outline" className="w-full">
                <Link href={"/admin/clients/" + studentId}>
                  View Full Profile <ArrowRight className="ml-2 h-3 w-3" />
                </Link>
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
