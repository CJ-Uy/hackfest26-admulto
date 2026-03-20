"use client";

import { useParams } from "next/navigation";
import { Sidebar } from "@/components/shared/Sidebar";
import { PostDetail } from "@/components/detail/PostDetail";
import { papers } from "@/lib/data/papers";

export default function PostPage() {
  const params = useParams();
  const scrollId = params.id as string;
  const postId = params.postId as string;

  const paper = papers.find((p) => p.id === postId);

  if (!paper) {
    return (
      <div className="flex min-h-screen">
        <Sidebar />
        <main className="flex flex-1 items-center justify-center">
          <p className="text-muted-foreground">Paper not found.</p>
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1">
        <PostDetail paper={paper} scrollId={scrollId} />
      </main>
    </div>
  );
}
