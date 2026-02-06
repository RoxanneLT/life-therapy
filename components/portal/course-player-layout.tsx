"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { Button } from "@/components/ui/button";

interface CoursePlayerLayoutProps {
  sidebar: React.ReactNode;
  children: React.ReactNode;
}

/**
 * Two-panel layout for the course player.
 * Left sidebar (collapsible) + main content area.
 */
export function CoursePlayerLayout({
  sidebar,
  children,
}: CoursePlayerLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(true);

  return (
    <div className="flex h-[calc(100vh-4rem)] overflow-hidden">
      {/* Sidebar */}
      <div
        className={cn(
          "flex-shrink-0 overflow-y-auto border-r bg-card transition-all",
          sidebarOpen ? "w-72" : "w-0"
        )}
      >
        {sidebarOpen && <div className="p-3">{sidebar}</div>}
      </div>

      {/* Main content */}
      <div className="flex flex-1 flex-col overflow-y-auto">
        <div className="border-b px-4 py-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSidebarOpen(!sidebarOpen)}
          >
            {sidebarOpen ? (
              <PanelLeftClose className="h-4 w-4" />
            ) : (
              <PanelLeftOpen className="h-4 w-4" />
            )}
          </Button>
        </div>
        <div className="flex-1 overflow-y-auto p-6">{children}</div>
      </div>
    </div>
  );
}
