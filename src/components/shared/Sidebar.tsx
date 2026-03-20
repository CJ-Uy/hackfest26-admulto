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
import { scrollSessions as mockScrollSessions } from "@/lib/data/scrolls";
import { fetchAllScrollSessions } from "@/lib/scroll-store";
import type { ScrollSession } from "@/lib/types";
import { cn } from "@/lib/utils";

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const [sessions, setSessions] = useState<ScrollSession[]>(mockScrollSessions);

  useEffect(() => {
    async function load() {
      const stored = await fetchAllScrollSessions();
      // Merge DB scrolls with mock, deduplicating by id
      const ids = new Set(stored.map((s) => s.id));
      const merged = [
        ...stored,
        ...mockScrollSessions.filter((s) => !ids.has(s.id)),
      ];
      setSessions(merged);
    }

    load();
  }, []);

  return (
    <div className="flex h-full flex-col">
      <div className="p-5">
        <Link
          href="/"
          onClick={onNavigate}
          className="font-heading text-xl font-bold tracking-tight text-primary"
        >
          Schrollar
        </Link>
      </div>

      <div className="px-3">
        <Link href="/onboarding" onClick={onNavigate}>
          <Button className="w-full justify-start gap-2" size="sm">
            <Plus className="h-4 w-4" />
            Create New Scroll
          </Button>
        </Link>
      </div>

      <Separator className="mx-3 my-4 w-auto" />

      <div className="flex-1 overflow-y-auto px-3">
        <p className="mb-2 px-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">
          Past Scrolls
        </p>
        <nav className="space-y-1">
          {sessions.map((session) => (
            <Link
              key={session.id}
              href={`/scroll/${session.id}`}
              onClick={onNavigate}
              className={cn(
                "flex items-start gap-2.5 rounded-md px-2 py-2 text-sm transition-colors hover:bg-accent",
                pathname === `/scroll/${session.id}` && "bg-accent"
              )}
            >
              <ScrollText className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
              <div className="min-w-0">
                <p className="truncate font-medium leading-tight">
                  {session.title}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {session.paperCount} papers found
                </p>
              </div>
            </Link>
          ))}
        </nav>
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
          "hidden h-screen shrink-0 border-r border-border bg-sidebar transition-all duration-300 md:sticky md:top-0 md:flex md:flex-col",
          collapsed ? "md:w-16" : "md:w-64"
        )}
      >
        {collapsed ? (
          <div className="flex h-full flex-col items-center py-4">
            <Button
              variant="ghost"
              size="icon"
              className="mb-4"
              onClick={() => setCollapsed(false)}
            >
              <PanelLeftOpen className="h-4 w-4" />
            </Button>
            <Link href="/onboarding">
              <Button variant="ghost" size="icon">
                <Plus className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        ) : (
          <>
            <SidebarContent />
            <div className="border-t border-border p-3">
              <Button
                variant="ghost"
                size="sm"
                className="w-full justify-start gap-2 text-muted-foreground"
                onClick={() => setCollapsed(true)}
              >
                <PanelLeftClose className="h-4 w-4" />
                <span className="text-xs">Collapse</span>
              </Button>
            </div>
          </>
        )}
      </aside>
    </>
  );
}
