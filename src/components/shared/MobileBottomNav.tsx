"use client";

import { BarChart3, Plus } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { SidebarContent } from "@/components/shared/Sidebar";
import { SchrollarLogo } from "@/components/shared/SchrollarLogo";
import { CreatePostFAB } from "@/components/feed/CreatePostFAB";
import { RightSidebar } from "@/components/shared/RightSidebar";
import type { ScrollSession, Paper, UserPost } from "@/lib/types";

interface MobileBottomNavProps {
  scrollId: string;
  onPost: (post: UserPost) => void;
  scroll: ScrollSession;
  papers: Paper[];
  upvotedPapers: Set<string>;
  downvotedPapers: Set<string>;
  bookmarkedPapers: Set<string>;
  yourCommentCounts: Map<string, number>;
  userPosts: UserPost[];
}

export function MobileBottomNav({
  scrollId,
  onPost,
  scroll,
  papers,
  upvotedPapers,
  downvotedPapers,
  bookmarkedPapers,
  yourCommentCounts,
  userPosts,
}: MobileBottomNavProps) {
  const navTriggerClassName =
    "hover:bg-subtle text-foreground flex h-12 w-full items-center justify-center gap-1.5 rounded-lg px-2 text-[13px] font-semibold transition-colors";

  return (
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

        <CreatePostFAB
          scrollId={scrollId}
          onPost={onPost}
          showFloatingButton={false}
          triggerRender={<button className={navTriggerClassName} />}
          triggerContent={
            <>
              <Plus className="h-4 w-4" />
              Post
            </>
          }
        />

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
            <SheetTitle className="sr-only">Session info</SheetTitle>
            <div className="bg-muted mx-auto mt-2 h-1.5 w-10 rounded-full" />
            <div className="max-h-[calc(72vh-24px)] overflow-y-auto p-4 pb-8">
              <RightSidebar
                scroll={scroll}
                papers={papers}
                upvotedPapers={upvotedPapers}
                downvotedPapers={downvotedPapers}
                bookmarkedPapers={bookmarkedPapers}
                yourCommentCounts={yourCommentCounts}
                userPosts={userPosts}
                scrollId={scrollId}
                contentOnly
              />
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </div>
  );
}
