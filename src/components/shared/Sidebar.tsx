"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  ScrollText,
  Menu,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
  SheetTitle,
} from "@/components/ui/sheet";
import { fetchAllScrollSessions } from "@/lib/scroll-store";
import type { ScrollSession } from "@/lib/types";
import { cn } from "@/lib/utils";

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const [sessions, setSessions] = useState<ScrollSession[]>([]);

  useEffect(() => {
    async function load() {
      const stored = await fetchAllScrollSessions();
      setSessions(stored);
    }

    load();
  }, []);

  return (
    <div className="flex h-full flex-col">
      <div className="px-4 py-3">
        <Link
          href="/"
          onClick={onNavigate}
          className="font-heading text-primary text-[22px] font-bold tracking-tight"
        >
          Schrollar
        </Link>
      </div>

      <div className="px-3">
        <Link href="/onboarding" onClick={onNavigate}>
          <Button className="w-full justify-start gap-2 text-[15px]" size="sm">
            <Plus className="h-3.5 w-3.5" />
            New Scroll
          </Button>
        </Link>
      </div>

      <Separator className="mx-3 my-3 w-auto" />

      <div className="flex-1 overflow-y-auto px-3">
        <p className="text-muted-foreground mb-1.5 px-2 text-[13px] font-bold tracking-wide uppercase">
          Recent
        </p>
        {sessions.length === 0 ? (
          <p className="text-muted-foreground px-2 text-[14px]">
            No scrolls yet.
          </p>
        ) : (
          <nav className="space-y-0.5">
            {sessions.map((session) => (
              <Link
                key={session.id}
                href={`/scroll/${session.id}`}
                onClick={onNavigate}
                className={cn(
                  "flex items-start gap-2 rounded-md px-2 py-1.5 transition-colors hover:bg-[#f6f7f8]",
                  pathname === `/scroll/${session.id}` && "bg-[#f6f7f8]",
                )}
              >
                <ScrollText className="text-muted-foreground mt-0.5 h-3.5 w-3.5 shrink-0" />
                <div className="min-w-0">
                  <p className="text-foreground truncate text-[14px] leading-tight font-medium">
                    {session.title}
                  </p>
                  <p className="text-muted-foreground text-[13px]">
                    {session.paperCount} papers
                  </p>
                </div>
              </Link>
            ))}
          </nav>
        )}
      </div>
    </div>
  );
}

export function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <>
      {/* Mobile hamburger */}
      <div className="fixed top-0 left-0 z-50 p-3 md:hidden">
        <Sheet>
          <SheetTrigger
            render={
              <Button variant="outline" size="icon" className="h-9 w-9" />
            }
          >
            <Menu className="h-4 w-4" />
          </SheetTrigger>
          <SheetContent side="left" className="w-72 p-0">
            <SheetTitle className="sr-only">Navigation</SheetTitle>
            <SidebarContent />
          </SheetContent>
        </Sheet>
      </div>

      {/* Desktop sidebar */}
      <aside
        className={cn(
          "border-border bg-sidebar hidden h-screen shrink-0 border-r transition-all duration-300 md:sticky md:top-0 md:flex md:flex-col",
          collapsed ? "md:w-16" : "md:w-64",
        )}
      >
        {collapsed ? (
          <div className="flex h-full flex-col items-center py-3">
            <Button
              variant="ghost"
              size="icon"
              className="mb-3 h-8 w-8"
              onClick={() => setCollapsed(false)}
            >
              <PanelLeftOpen className="h-3.5 w-3.5" />
            </Button>
            <Link href="/onboarding">
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <Plus className="h-3.5 w-3.5" />
              </Button>
            </Link>
          </div>
        ) : (
          <>
            <SidebarContent />
            <div className="border-border border-t p-2">
              <Button
                variant="ghost"
                size="sm"
                className="text-muted-foreground w-full justify-start gap-2 text-[14px]"
                onClick={() => setCollapsed(true)}
              >
                <PanelLeftClose className="h-3.5 w-3.5" />
                Collapse
              </Button>
            </div>
          </>
        )}
      </aside>
    </>
  );
}
