"use client";

import { useState, useEffect } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import type { Comment } from "@/lib/types";

interface DetailTabsProps {
  paperId: string;
}

export function DetailTabs({ paperId }: DetailTabsProps) {
  const [tab, setTab] = useState("comments");
  const [comments, setComments] = useState<Comment[]>([]);

  useEffect(() => {
    async function loadComments() {
      try {
        const res = await fetch(`/api/comments?paperId=${paperId}`);
        if (res.ok) {
          const data = await res.json();
          setComments(data as Comment[]);
        }
      } catch {
        // ignore
      }
    }
    loadComments();
  }, [paperId]);

  return (
    <Tabs value={tab} onValueChange={setTab}>
      <TabsList className="w-full">
        <TabsTrigger value="comments" className="flex-1">
          Comments ({comments.length})
        </TabsTrigger>
      </TabsList>

      <TabsContent value="comments" className="mt-4 space-y-3">
        {comments.map((c) => (
          <div key={c.id} className="rounded-lg border border-border bg-card p-4">
            <div className="mb-2 flex items-center gap-2">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold">
                {c.author.charAt(0).toUpperCase()}
              </div>
              <span className="text-sm font-medium">{c.author}</span>
              <span className="text-xs text-muted-foreground">
                {new Date(c.createdAt).toLocaleDateString()}
              </span>
            </div>
            <p className="text-sm leading-relaxed">{c.content}</p>
          </div>
        ))}
        {comments.length === 0 && (
          <p className="py-8 text-center text-sm text-muted-foreground">
            No comments yet. Be the first to comment!
          </p>
        )}
      </TabsContent>
    </Tabs>
  );
}
