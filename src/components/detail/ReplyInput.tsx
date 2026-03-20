import { Send } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export function ReplyInput() {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-border bg-card p-3">
      <Input
        placeholder="Ask a question about this paper..."
        className="border-0 bg-transparent shadow-none focus-visible:ring-0"
      />
      <Button size="icon" variant="ghost" className="shrink-0">
        <Send className="h-4 w-4" />
      </Button>
    </div>
  );
}
