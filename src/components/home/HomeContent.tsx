"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  ScrollText,
  Plus,
  BarChart3,
  FileText,
  Sparkles,
  Trash2,
  Loader2,
} from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Sidebar, SidebarContent } from "@/components/shared/Sidebar";
import { Navbar } from "@/components/shared/Navbar";
import { SchrollarLogo } from "@/components/shared/SchrollarLogo";
import { SidebarBrandCard } from "@/components/shared/SidebarBrandCard";
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { deleteScroll } from "@/lib/scroll-store";
import { toast } from "sonner";

interface ScrollItem {
  id: string;
  title: string;
  description: string;
  mode: string;
  date: string;
  paperCount: number;
  status: string;
}

interface HomeContentProps {
  scrolls: ScrollItem[];
}

export function HomeContent({ scrolls: initialScrolls }: HomeContentProps) {
  const router = useRouter();
  const [scrolls, setScrolls] = useState(initialScrolls);
  const [searchQuery, setSearchQuery] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<ScrollItem | null>(null);
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    const ok = await deleteScroll(deleteTarget.id);
    setDeleting(false);
    if (ok) {
      setScrolls((prev) => prev.filter((s) => s.id !== deleteTarget.id));
      toast.success("Schroll deleted");
    } else {
      toast.error("Failed to delete schroll");
    }
    setDeleteTarget(null);
  }

  const hasScrolls = scrolls.length > 0;
  const navTriggerClassName =
    "hover:bg-subtle text-foreground flex h-12 w-full items-center justify-center gap-1.5 rounded-lg px-2 text-[13px] font-semibold transition-colors";

  const filteredScrolls = searchQuery
    ? scrolls.filter(
        (s) =>
          s.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          s.description.toLowerCase().includes(searchQuery.toLowerCase()),
      )
    : scrolls;

  const homeSidebarContent = (
    <div>
      <SidebarBrandCard />
      <hr className="border-border" />
      {/* Stats */}
      <div className="pt-3 pb-3">
        <div className="grid grid-cols-2 gap-2">
          <div className="bg-subtle rounded-md p-2">
            <p className="text-muted-foreground text-[13px]">Schrolls</p>
            <p className="text-foreground text-[19px] font-bold">
              {scrolls.length}
            </p>
          </div>
          <div className="bg-subtle rounded-md p-2">
            <p className="text-muted-foreground text-[13px]">Papers</p>
            <p className="text-foreground text-[19px] font-bold">
              {scrolls.reduce((sum, s) => sum + s.paperCount, 0)}
            </p>
          </div>
        </div>
      </div>

      <hr className="border-border" />

      {/* Quick start */}
      {!hasScrolls && (
        <>
          <div className="py-3">
            <h4 className="text-foreground mb-2 text-[12px] font-bold tracking-widest uppercase">
              Getting Started
            </h4>
            <ol className="text-muted-foreground space-y-2 text-[14px]">
              <li className="flex gap-2">
                <span className="bg-primary/10 text-primary flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-bold">
                  1
                </span>
                Choose a research topic
              </li>
              <li className="flex gap-2">
                <span className="bg-primary/10 text-primary flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-bold">
                  2
                </span>
                AI finds and synthesizes papers
              </li>
              <li className="flex gap-2">
                <span className="bg-primary/10 text-primary flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-bold">
                  3
                </span>
                Browse your personalized feed
              </li>
            </ol>
          </div>
          <hr className="border-border" />
        </>
      )}
    </div>
  );

  return (
    <div className="bg-page-bg min-h-screen">
      <Navbar
        searchValue={searchQuery}
        onSearchChange={setSearchQuery}
        searchPlaceholder="Search your schrolls"
      />

      <div className="flex">
        <Sidebar showMobileTrigger={false} />

        <div className="flex min-w-0 flex-1 justify-center">
          {/* Main content */}
          <main className="border-border w-full max-w-215 min-w-0 flex-1 border-x pb-24 md:pb-0">
            {hasScrolls ? (
              <>
                {/* Hero area */}
                <section className="border-border border-b">
                  <div className="px-5 py-5">
                    <div className="flex items-center gap-4">
                      <div className="bg-background border-border flex h-28 w-28 shrink-0 items-center justify-center rounded-full border-4 shadow-sm">
                        <SchrollarLogo
                          showText={false}
                          size="lg"
                          className="scale-180"
                        />
                      </div>

                      <div className="min-w-0 flex-1 px-4 py-4">
                        <div className="flex items-center gap-3">
                          <h1 className="font-heading text-foreground text-[34px] leading-none font-bold tracking-tight whitespace-nowrap md:text-[38px]">
                            Schrollar
                          </h1>
                          <Link
                            href="/onboarding"
                            className="ml-auto inline-block shrink-0"
                          >
                            <Button
                              className="h-10 gap-2 px-4 text-[15px] font-semibold"
                              size="lg"
                            >
                              <Plus className="h-4.5 w-4.5" />
                              New Schroll
                            </Button>
                          </Link>
                        </div>

                        <p className="text-muted-foreground mt-2 max-w-2xl text-[16px] leading-relaxed md:text-[17px]">
                          A profile-style home for your active research streams,
                          where each schroll turns papers into a readable,
                          social feed.
                        </p>
                      </div>
                    </div>
                  </div>
                </section>

                {/* Feed header */}
                <div className="border-border border-b px-5 py-4">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-[15px] font-semibold">
                    <p className="text-muted-foreground">Your Research Feed</p>
                    <p className="text-muted-foreground">
                      {scrolls.length}{" "}
                      {scrolls.length === 1 ? "schroll" : "schrolls"} created
                    </p>
                  </div>
                </div>

                {/* Scroll cards */}
                <div className="divide-border divide-y">
                  {filteredScrolls.map((scroll, i) => (
                    <article
                      key={scroll.id}
                      className="group animate-card-enter hover:bg-subtle cursor-pointer px-5 py-4 transition-colors"
                      style={{ animationDelay: `${i * 40}ms` }}
                      onClick={() => router.push(`/schroll/${scroll.id}`)}
                    >
                      <div className="flex items-start gap-3">
                        {/* Icon */}
                        <div className="bg-primary/10 text-primary mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-lg">
                          <ScrollText className="h-5 w-5" />
                        </div>

                        <div className="min-w-0 flex-1">
                          {/* Title row */}
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="font-heading text-foreground truncate text-[18px] leading-tight font-bold">
                              {scroll.title}
                            </h3>
                            {scroll.status === "generating" && (
                              <div className="flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[12px] font-semibold text-amber-600">
                                <Loader2 className="h-3 w-3 animate-spin" />
                                Generating
                              </div>
                            )}
                            <span className="bg-primary/10 text-primary shrink-0 rounded-full px-2 py-0.5 text-[12px] font-semibold">
                              {scroll.mode === "pdf_only"
                                ? "PDF Only"
                                : scroll.mode === "pdf_context"
                                  ? "PDF + Research"
                                  : scroll.mode === "pdf_include"
                                    ? "PDF + Research"
                                    : scroll.mode === "brainstorm"
                                      ? "Brainstorm"
                                      : "Research"}
                            </span>
                          </div>

                          {/* Description */}
                          <p className="text-muted-foreground mt-1.5 line-clamp-2 text-[15px] leading-relaxed">
                            {scroll.description}
                          </p>

                          {/* Meta */}
                          <div className="text-muted-foreground mt-2 flex items-center gap-4 text-[14px]">
                            <span className="flex items-center gap-1">
                              <FileText className="h-3.5 w-3.5" />
                              {scroll.paperCount} papers
                            </span>
                            <span>{scroll.date}</span>
                          </div>
                        </div>

                        {/* Delete button */}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeleteTarget(scroll);
                          }}
                          className="text-muted-foreground hover:text-destructive mt-1 shrink-0 opacity-0 transition-opacity group-hover:opacity-100"
                          aria-label={`Delete ${scroll.title}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </article>
                  ))}
                  {searchQuery && filteredScrolls.length === 0 && (
                    <div className="px-4 py-8 text-center">
                      <p className="text-muted-foreground text-[16px]">
                        No schrolls matching &ldquo;{searchQuery}&rdquo;
                      </p>
                    </div>
                  )}
                </div>
              </>
            ) : (
              /* Empty state */
              <div className="flex flex-col items-center justify-center px-6 py-24">
                <div className="pointer-events-none absolute inset-0 overflow-hidden">
                  <div className="bg-primary/5 absolute -top-40 -right-40 h-100 w-100 rounded-full blur-3xl" />
                  <div className="bg-primary/5 absolute -bottom-40 -left-40 h-75 w-75 rounded-full blur-3xl" />
                </div>

                <div className="animate-fade-in relative z-10 max-w-lg text-center">
                  <div className="bg-primary/10 text-primary mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-2xl">
                    <SchrollarLogo showText={false} size="lg" />
                  </div>

                  <h1 className="font-heading text-foreground text-[32px] font-bold tracking-tight md:text-[40px]">
                    Welcome to Schrollar
                  </h1>

                  <p className="text-muted-foreground mx-auto mt-3 max-w-md text-[17px] leading-relaxed">
                    Turn your schroll into research. Create your first schroll
                    to discover papers in a social-media-style feed.
                  </p>

                  <Link href="/onboarding" className="mt-8 inline-block">
                    <Button size="lg" className="gap-2 px-8 text-base">
                      <Sparkles className="h-4 w-4" />
                      Create Your First Schroll
                      <ArrowRight className="h-4 w-4" />
                    </Button>
                  </Link>

                  <p className="text-muted-foreground/60 mt-5 text-[12px]">
                    Research discovery, reimagined as a feed you already know
                    how to use.
                  </p>

                  <a
                    href="https://github.com/CJ-Uy/hackfest26-admulto"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-muted-foreground/60 hover:text-muted-foreground mt-3 inline-flex items-center gap-1.5 text-[12px] transition-colors"
                  >
                    <svg
                      viewBox="0 0 16 16"
                      className="h-3.5 w-3.5 fill-current"
                      aria-hidden="true"
                    >
                      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
                    </svg>
                    View Source Code
                  </a>
                </div>
              </div>
            )}
          </main>

          {/* Right sidebar - stats summary */}
          <aside className="no-scrollbar hidden w-78 shrink-0 px-3 lg:sticky lg:top-12 lg:block lg:max-h-[calc(100vh-48px)] lg:overflow-y-auto">
            {homeSidebarContent}
          </aside>
        </div>
      </div>

      <div className="border-border bg-background/95 fixed inset-x-0 bottom-0 z-50 border-t px-3 py-2 pb-[calc(env(safe-area-inset-bottom)+8px)] backdrop-blur md:hidden">
        <div className="grid grid-cols-3 gap-2">
          <Sheet>
            <SheetTrigger render={<button className={navTriggerClassName} />}>
              <SchrollarLogo showText={false} size="sm" />
              Menu
            </SheetTrigger>
            <SheetContent side="left" className="w-72 p-0">
              <SheetTitle className="sr-only">Navigation</SheetTitle>
              <SidebarContent />
            </SheetContent>
          </Sheet>

          <Link href="/onboarding" className={navTriggerClassName}>
            <Plus className="h-4 w-4" />
            New
          </Link>

          <Sheet>
            <SheetTrigger render={<button className={navTriggerClassName} />}>
              <BarChart3 className="h-4 w-4" />
              Insights
            </SheetTrigger>
            <SheetContent
              side="bottom"
              showCloseButton={false}
              className="h-auto max-h-[72vh] overflow-hidden rounded-t-2xl p-0"
            >
              <SheetTitle className="sr-only">Home insights</SheetTitle>
              <div className="bg-muted mx-auto mt-2 h-1.5 w-10 rounded-full" />
              <div className="max-h-[calc(72vh-24px)] overflow-y-auto p-4 pb-8">
                {homeSidebarContent}
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>

      {/* Delete dialog */}
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
