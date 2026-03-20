import { User } from "lucide-react";
import type { UserComment as UserCommentType } from "@/lib/types";

interface UserCommentProps {
  comment: UserCommentType;
}

export function UserComment({ comment }: UserCommentProps) {
  const replyInitial = comment.aiReplyAuthor.charAt(0).toUpperCase();

  return (
    <div className="space-y-3">
      {/* User message */}
      <div className="rounded-lg border border-border bg-card p-4">
        <div className="mb-2 flex items-center gap-2">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted">
            <User className="h-3.5 w-3.5 text-muted-foreground" />
          </div>
          <span className="text-sm font-medium">You</span>
        </div>
        <p className="text-sm leading-relaxed">{comment.userMessage}</p>
      </div>

      {/* AI reply */}
      <div className="ml-6 rounded-lg border border-primary/20 bg-primary/5 p-4">
        <div className="mb-2 flex items-center gap-2">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
            {replyInitial}
          </div>
          <span className="text-sm font-medium text-primary">
            {comment.aiReplyAuthor}
          </span>
        </div>
        <p className="text-sm leading-relaxed text-foreground">
          {comment.aiReply}
        </p>
      </div>
    </div>
  );
}
