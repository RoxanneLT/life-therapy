"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { SlidersHorizontal } from "lucide-react";

interface CatalogFilterDrawerProps {
  readonly children: React.ReactNode;
}

export function CatalogFilterDrawer({ children }: CatalogFilterDrawerProps) {
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <SlidersHorizontal className="h-4 w-4" />
          Filters
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-72">
        <SheetHeader>
          <SheetTitle>Filters</SheetTitle>
        </SheetHeader>
        {/* onClick on links inside will close the drawer via navigation */}
        <div onClick={() => setOpen(false)}>{children}</div>
      </SheetContent>
    </Sheet>
  );
}
