"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Plus, ScrollText, Menu, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { fetchAllScrollSessions, deleteScroll } from "@/lib/scroll-store";
import type { ScrollSession } from "@/lib/types";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { ThemeToggle } from "./ThemeToggle";

export function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const router = useRouter();
  const [sessions, setSessions] = useState<ScrollSession[]>([]);
  const [deleteTarget, setDeleteTarget] = useState<ScrollSession | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    async function load() {
      const stored = await fetchAllScrollSessions();
      setSessions(stored);
    }

    load();
  }, []);

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    const ok = await deleteScroll(deleteTarget.id);
    setDeleting(false);
    if (ok) {
      setSessions((prev) => prev.filter((s) => s.id !== deleteTarget.id));
      toast.success("Schroll deleted");
      if (pathname === `/schroll/${deleteTarget.id}`) {
        router.push("/");
      }
    } else {
      toast.error("Failed to delete schroll");
    }
    setDeleteTarget(null);
  }

  return (
    <div className="flex h-full flex-col">
      <div className="px-3 pt-3">
        <Link href="/onboarding" onClick={onNavigate}>
          <Button
            className="h-9 w-full justify-start gap-2 text-[14px]"
            size="sm"
          >
            <Plus className="h-3.5 w-3.5" />
            New Schroll
          </Button>
        </Link>
      </div>

      <Separator className="mx-3 my-3 w-auto" />

      <div className="flex-1 overflow-y-auto px-3">
        <p className="text-muted-foreground mb-1.5 px-2 text-[11px] font-bold tracking-widest uppercase">
          Recent
        </p>
        {sessions.length === 0 ? (
          <p className="text-muted-foreground px-2 text-[13px]">
            No schrolls yet.
          </p>
        ) : (
          <nav className="space-y-0.5">
            {sessions.map((session) => (
              <div
                key={session.id}
                className={cn(
                  "group hover:bg-subtle flex items-start gap-2 rounded-md px-2 py-1.5 transition-colors",
                  pathname === `/schroll/${session.id}` && "bg-subtle",
                )}
              >
                <Link
                  href={`/schroll/${session.id}`}
                  onClick={onNavigate}
                  className="flex min-w-0 flex-1 items-start gap-2"
                >
                  <ScrollText className="text-muted-foreground mt-0.5 h-3.5 w-3.5 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-foreground truncate text-[13px] leading-tight font-medium">
                      {session.title}
                    </p>
                    <p className="text-muted-foreground text-[12px]">
                      {session.paperCount} papers
                    </p>
                  </div>
                </Link>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setDeleteTarget(session);
                  }}
                  className="text-muted-foreground hover:text-destructive mt-0.5 shrink-0 opacity-0 transition-opacity group-hover:opacity-100"
                  aria-label={`Delete ${session.title}`}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </nav>
        )}
      </div>

      <div className="border-border border-t px-3 py-2">
        <ThemeToggle />
      </div>

      <Dialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
      >
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>Delete schroll</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete &ldquo;{deleteTarget?.title}
              &rdquo;? This will permanently remove the schroll and all its
              papers, comments, and votes.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteTarget(null)}
              disabled={deleting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleting}
            >
              {deleting ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export function Sidebar({
  showMobileTrigger = true,
}: {
  showMobileTrigger?: boolean;
}) {
  return (
    <>
      {/* Mobile hamburger */}
      {showMobileTrigger && (
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
      )}

      {/* Desktop sidebar */}
      <aside className="no-scrollbar hidden w-[272px] shrink-0 overflow-y-auto border-r border-border md:sticky md:top-12 md:flex md:h-[calc(100vh-48px)] md:flex-col">
        <SidebarContent />
      </aside>
    </>
  );
}
