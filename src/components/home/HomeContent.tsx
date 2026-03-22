"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  ScrollText,
  Plus,
  FileText,
  Sparkles,
  Trash2,
  Loader2,
} from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Sidebar } from "@/components/shared/Sidebar";
import { SchrollarLogo } from "@/components/shared/SchrollarLogo";
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

  return (
    <div className="flex min-h-screen bg-[#dae0e6]">
      <Sidebar />

      <div className="flex flex-1 justify-center gap-0 lg:gap-6 lg:px-6 lg:py-4">
        {/* Main content */}
        <main className="bg-background w-full max-w-[780px] flex-1 lg:rounded-t-lg">
          {hasScrolls ? (
            <>
              {/* Header with CTA */}
              <div className="border-border border-b px-4 pt-14 pb-4 md:pt-5">
                <div className="flex items-center justify-between">
                  <div>
                    <h1 className="font-heading text-foreground text-[22px] font-bold">
                      Your Research Feed
                    </h1>
                    <p className="text-muted-foreground mt-0.5 text-[14px]">
                      {scrolls.length}{" "}
                      {scrolls.length === 1 ? "schroll" : "schrolls"} created
                    </p>
                  </div>
                  <Link href="/onboarding">
                    <Button className="gap-2">
                      <Plus className="h-4 w-4" />
                      New Schroll
                    </Button>
                  </Link>
                </div>
              </div>

              {/* Scroll cards */}
              <div className="divide-border divide-y">
                {scrolls.map((scroll, i) => (
                  <article
                    key={scroll.id}
                    className="group animate-card-enter cursor-pointer px-4 py-4 transition-colors hover:bg-[#fafafa]"
                    style={{ animationDelay: `${i * 40}ms` }}
                    onClick={() => router.push(`/schroll/${scroll.id}`)}
                  >
                    <div className="flex items-start gap-3">
                      {/* Icon */}
                      <div className="bg-primary/10 text-primary mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl">
                        <ScrollText className="h-5 w-5" />
                      </div>

                      <div className="min-w-0 flex-1">
                        {/* Title row */}
                        <div className="flex items-center gap-2">
                          <h3 className="font-heading text-foreground truncate text-[16px] font-bold">
                            {scroll.title}
                          </h3>
                          {scroll.status === "generating" && (
                            <div className="flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-600">
                              <Loader2 className="h-3 w-3 animate-spin" />
                              Generating
                            </div>
                          )}
                          <span className="bg-primary/10 text-primary shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold">
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
                        <p className="text-muted-foreground mt-1 line-clamp-2 text-[14px] leading-relaxed">
                          {scroll.description}
                        </p>

                        {/* Meta */}
                        <div className="text-muted-foreground mt-2 flex items-center gap-3 text-[13px]">
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
              </div>
            </>
          ) : (
            /* Empty state */
            <div className="flex flex-col items-center justify-center px-6 py-24">
              {/* Background decorative */}
              <div className="pointer-events-none absolute inset-0 overflow-hidden">
                <div className="bg-primary/5 absolute -top-40 -right-40 h-[400px] w-[400px] rounded-full blur-3xl" />
                <div className="bg-primary/5 absolute -bottom-40 -left-40 h-[300px] w-[300px] rounded-full blur-3xl" />
              </div>

              <div className="animate-fade-in relative z-10 max-w-lg text-center">
                <div className="bg-primary/10 text-primary mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-2xl">
                  <SchrollarLogo showText={false} size="lg" />
                </div>

                <h1 className="font-heading text-foreground text-[28px] font-bold tracking-tight md:text-[36px]">
                  Welcome to Schrollar
                </h1>

                <p className="text-muted-foreground mx-auto mt-3 max-w-md text-[15px] leading-relaxed">
                  Turn your schroll into research. Create your first schroll to
                  discover papers in a social-media-style feed.
                </p>

                <Link href="/onboarding" className="mt-8 inline-block">
                  <Button size="lg" className="gap-2 px-8 text-base">
                    <Sparkles className="h-4 w-4" />
                    Create Your First Schroll
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </Link>

                <p className="text-muted-foreground/60 mt-5 text-[12px]">
                  Research discovery, reimagined as a feed you already know how
                  to use.
                </p>
              </div>
            </div>
          )}
        </main>

        {/* Right sidebar - stats summary */}
        <aside className="no-scrollbar hidden w-[340px] shrink-0 lg:sticky lg:top-4 lg:block lg:max-h-[calc(100vh-32px)] lg:overflow-y-auto">
          <div className="space-y-3">
            {/* App info card */}
            <div className="border-border bg-background rounded-lg border p-4">
              <div className="bg-primary mb-3 rounded-md px-3 py-2.5">
                <SchrollarLogo size="sm" className="text-primary-foreground" />
              </div>
              <p className="text-muted-foreground text-[14px] leading-relaxed">
                Discover academic papers through an AI-powered social media
                feed. Upvote, comment, and fine-tune your research experience.
              </p>
              <div className="border-border mt-3 border-t pt-3">
                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-md bg-[#f6f7f8] p-2.5">
                    <p className="text-muted-foreground text-[13px]">
                      Schrolls
                    </p>
                    <p className="text-foreground text-[18px] font-bold">
                      {scrolls.length}
                    </p>
                  </div>
                  <div className="rounded-md bg-[#f6f7f8] p-2.5">
                    <p className="text-muted-foreground text-[13px]">Papers</p>
                    <p className="text-foreground text-[18px] font-bold">
                      {scrolls.reduce((sum, s) => sum + s.paperCount, 0)}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Quick start */}
            {!hasScrolls && (
              <div className="border-border bg-background rounded-lg border p-4">
                <h4 className="text-foreground mb-2 text-[13px] font-bold tracking-wide uppercase">
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
            )}
          </div>
        </aside>
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
