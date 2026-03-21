"use client";

import Link from "next/link";
import { ScrollText, FileText, Loader2 } from "lucide-react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
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
    <Link href={`/schroll/${id}`} className="block">
      <Card className="hover:ring-primary/20 transition-all duration-200 hover:shadow-md hover:ring-2">
        <CardHeader>
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2">
              <ScrollText className="text-primary h-4 w-4 shrink-0" />
              <CardTitle className="line-clamp-1">{title}</CardTitle>
            </div>
            {isGenerating ? (
              <Badge variant="secondary" className="shrink-0 gap-1">
                <Loader2 className="h-3 w-3 animate-spin" />
                Generating
              </Badge>
            ) : (
              <Badge variant="outline" className="shrink-0 gap-1">
                <FileText className="h-3 w-3" />
                {paperCount} papers
              </Badge>
            )}
          </div>
          {description && (
            <CardDescription className="mt-1 line-clamp-2">
              {description}
            </CardDescription>
          )}
          <p className="text-muted-foreground mt-1 text-xs">
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
