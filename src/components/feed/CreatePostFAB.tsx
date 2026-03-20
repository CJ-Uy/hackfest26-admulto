"use client";

import { useState } from "react";
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
}

export function CreatePostFAB({ scrollId, onPost }: CreatePostFABProps) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");

  function handleSubmit() {
    if (!content.trim()) return;

    const post: UserPost = {
      id: `post-${Date.now()}`,
      title: title.trim() || undefined,
      content: content.trim(),
      createdAt: new Date().toISOString(),
    };

    onPost(post);
    toast.success("Post created");
    setTitle("");
    setContent("");
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <button className="fixed bottom-6 right-6 z-50 flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition-all hover:scale-105 hover:shadow-xl active:scale-95" />
        }
      >
        <Plus className="h-5 w-5" />
      </DialogTrigger>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle className="font-heading text-[16px]">Create a post</DialogTitle>
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
            <Button variant="ghost" size="sm" onClick={() => setOpen(false)} className="text-[13px]">
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleSubmit}
              disabled={!content.trim()}
              className="gap-1.5 text-[13px]"
            >
              <Send className="h-3.5 w-3.5" />
              Post
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
