"use client";

import Link from "next/link";
import { ScrollText, FileText, Loader2 } from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface ScrollCardProps {
  id: string;
  title: string;
  description: string;
  date: string;
  paperCount: number;
  status: string;
}

export function ScrollCard({
  id,
  title,
  description,
  date,
  paperCount,
  status,
}: ScrollCardProps) {
  const isGenerating = status === "generating";

  return (
    <Link href={`/scroll/${id}`} className="block">
      <Card className="transition-all duration-200 hover:ring-2 hover:ring-primary/20 hover:shadow-md">
        <CardHeader>
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2">
              <ScrollText className="h-4 w-4 text-primary shrink-0" />
              <CardTitle className="line-clamp-1">{title}</CardTitle>
            </div>
            {isGenerating ? (
              <Badge variant="secondary" className="gap-1 shrink-0">
                <Loader2 className="h-3 w-3 animate-spin" />
                Generating
              </Badge>
            ) : (
              <Badge variant="outline" className="gap-1 shrink-0">
                <FileText className="h-3 w-3" />
                {paperCount} papers
              </Badge>
            )}
          </div>
          {description && (
            <CardDescription className="line-clamp-2 mt-1">
              {description}
            </CardDescription>
          )}
          <p className="text-muted-foreground text-xs mt-1">
            {formatDate(date)}
          </p>
        </CardHeader>
      </Card>
    </Link>
  );
}

function formatDate(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return dateStr;
  }
}
