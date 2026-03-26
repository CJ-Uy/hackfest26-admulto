import { Skeleton } from "@/components/ui/skeleton";

export function FeedSkeleton() {
  return (
    <div>
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="border-border border-b px-4 py-3">
          {/* Author row */}
          <div className="mb-2 flex items-center gap-2.5">
            <Skeleton className="h-9 w-9 rounded-full" />
            <Skeleton className="h-4 w-36" />
            <Skeleton className="h-3 w-20" />
          </div>
          {/* Title */}
          <Skeleton className="mb-1 h-5 w-4/5" />
          {/* Synthesis lines */}
          <Skeleton className="mb-1 h-4 w-full" />
          <Skeleton className="mb-1 h-4 w-full" />
          <Skeleton className="h-4 w-3/5" />
          {/* Actions row */}
          <div className="mt-2 flex items-center gap-2">
            <Skeleton className="h-8 w-24 rounded-full" />
            <Skeleton className="h-6 w-14 rounded-full" />
            <Skeleton className="h-8 w-16 rounded-full" />
            <Skeleton className="h-8 w-16 rounded-full" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function PostDetailSkeleton() {
  return (
    <div className="mx-auto max-w-[780px] px-4 pt-4 pb-4">
      {/* Back button */}
      <Skeleton className="mb-3 h-5 w-28" />

      {/* Post header area */}
      <div className="border-border border-b px-1 pb-3">
        <div className="mb-2 flex items-center gap-2.5">
          <Skeleton className="h-9 w-9 rounded-full" />
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-4 w-28" />
        </div>

        <Skeleton className="mb-1 h-7 w-3/4" />
        <Skeleton className="mb-1 h-4 w-full" />
        <Skeleton className="mb-1 h-4 w-full" />
        <Skeleton className="h-4 w-2/3" />

        <Skeleton className="mt-2 h-4 w-32" />

        <div className="mt-3 flex items-center gap-2">
          <Skeleton className="h-8 w-24 rounded-full" />
          <Skeleton className="h-8 w-16 rounded-full" />
          <Skeleton className="h-8 w-16 rounded-full" />
        </div>
      </div>
      {/* Comments area */}
      <div className="mt-4 space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="border-border rounded-lg border p-4">
            <div className="mb-2 flex items-center gap-2">
              <Skeleton className="h-8 w-8 rounded-full" />
              <Skeleton className="h-4 w-28" />
            </div>
            <Skeleton className="mb-1 h-4 w-full" />
            <Skeleton className="h-4 w-4/5" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function UserPostDetailSkeleton() {
  return (
    <div className="mx-auto max-w-[780px] px-4 pt-4 pb-4">
      <Skeleton className="mb-3 h-5 w-28" />

      <div className="border-border border-b px-1 pb-3">
        <div className="mb-2 flex items-center gap-2.5">
          <Skeleton className="h-9 w-9 rounded-full" />
          <Skeleton className="h-4 w-12" />
          <Skeleton className="h-4 w-16" />
        </div>

        <Skeleton className="mb-1 h-7 w-1/2" />
        <Skeleton className="mb-1 h-4 w-full" />
        <Skeleton className="mb-1 h-4 w-full" />
        <Skeleton className="h-4 w-4/5" />

        <div className="mt-3 flex items-center gap-1.5">
          <Skeleton className="h-4 w-4" />
          <Skeleton className="h-4 w-24" />
        </div>
      </div>

      <div className="mt-4 space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="border-border rounded-lg border p-4">
            <div className="mb-2 flex items-center gap-2">
              <Skeleton className="h-8 w-8 rounded-full" />
              <Skeleton className="h-4 w-28" />
            </div>
            <Skeleton className="mb-1 h-4 w-full" />
            <Skeleton className="h-4 w-4/5" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function RightSidebarSkeleton() {
  return (
    <aside className="no-scrollbar hidden w-[240px] shrink-0 px-3 lg:sticky lg:top-12 lg:block lg:max-h-[calc(100vh-48px)] lg:overflow-y-auto">
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="py-3 border-b border-border">
            <Skeleton className="mb-3 h-4 w-28" />
            <div className="space-y-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-5/6" />
              <Skeleton className="h-4 w-3/4" />
            </div>
          </div>
        ))}
      </div>
    </aside>
  );
}

// Backward-compatible alias for existing imports.
export const DetailSkeleton = PostDetailSkeleton;
