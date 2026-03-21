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

export function DetailSkeleton() {
  return (
    <div className="mx-auto max-w-[780px] px-4 py-4">
      {/* Back button */}
      <Skeleton className="mb-3 h-5 w-28" />
      {/* Paper card */}
      <div className="border-border rounded-lg border p-5">
        <div className="mb-3 flex items-center gap-2.5">
          <Skeleton className="h-10 w-10 rounded-full" />
          <div>
            <Skeleton className="mb-1 h-4 w-40" />
            <Skeleton className="h-3 w-28" />
          </div>
        </div>
        <Skeleton className="mb-2 h-7 w-3/4" />
        <Skeleton className="mb-1 h-4 w-full" />
        <Skeleton className="mb-1 h-4 w-full" />
        <Skeleton className="h-4 w-2/3" />
        <div className="mt-3 flex items-center gap-2">
          <Skeleton className="h-8 w-24 rounded-full" />
          <Skeleton className="h-8 w-16 rounded-full" />
          <Skeleton className="h-8 w-16 rounded-full" />
        </div>
      </div>
      {/* Comments skeleton */}
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
