"use client";

import { useState } from "react";
import type { ReactElement, ReactNode } from "react";
import { Plus, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import type { UserPost } from "@/lib/types";

interface CreatePostFABProps {
  scrollId: string;
  onPost: (post: UserPost) => void;
  showFloatingButton?: boolean;
  triggerRender?: ReactElement;
  triggerContent?: ReactNode;
}

export function CreatePostFAB({
  scrollId,
  onPost,
  showFloatingButton = true,
  triggerRender,
  triggerContent,
}: CreatePostFABProps) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit() {
    if (!content.trim() || submitting) return;
    setSubmitting(true);

    try {
      const res = await fetch("/api/user-posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scrollId,
          content: content.trim(),
          title: title.trim() || undefined,
        }),
      });

      if (res.ok) {
        const saved = (await res.json()) as {
          id: string;
          title?: string | null;
          content: string;
          commentCount: number;
          createdAt: string;
        };
        const post: UserPost = {
          id: saved.id,
          title: saved.title ?? undefined,
          content: saved.content,
          commentCount: saved.commentCount ?? 0,
          createdAt: saved.createdAt,
        };
        onPost(post);
        toast.success("Post created");
        setTitle("");
        setContent("");
        setOpen(false);
      } else {
        toast.error("Failed to create post");
      }
    } catch {
      toast.error("Failed to create post");
    } finally {
      setSubmitting(false);
    }
  }

  const resolvedTriggerRender =
    triggerRender ??
    (showFloatingButton ? (
      <button className="bg-primary text-primary-foreground fixed right-6 bottom-6 z-50 flex h-12 w-12 items-center justify-center rounded-full shadow-lg transition-all hover:scale-105 hover:shadow-xl active:scale-95 lg:right-6 lg:bottom-6" />
    ) : null);

  if (!resolvedTriggerRender) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={resolvedTriggerRender}>
        {triggerContent ?? <Plus className="h-5 w-5" />}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle className="font-heading text-[16px]">
            Create a post
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3 pt-1">
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Title (optional)"
            className="text-[13px]"
          />
          <Textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="What are your thoughts?"
            className="min-h-[100px] resize-none text-[13px]"
          />
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setOpen(false)}
              disabled={submitting}
              className="text-[13px]"
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleSubmit}
              disabled={!content.trim() || submitting}
              className="gap-1.5 text-[13px]"
            >
              <Send className="h-3.5 w-3.5" />
              {submitting ? "Posting..." : "Post"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
