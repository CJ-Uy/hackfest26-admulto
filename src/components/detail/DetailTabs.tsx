"use client";

import { useState } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { citationComments, userComments } from "@/lib/data/comments";
import { CitationComment } from "./CitationComment";
import { UserComment } from "./UserComment";

interface DetailTabsProps {
  paperId: string;
}

export function DetailTabs({ paperId }: DetailTabsProps) {
  const [tab, setTab] = useState("all");

  const citations = citationComments.filter((c) => c.paperId === paperId);
  const userCmts = userComments.filter((c) => c.paperId === paperId);

  return (
    <Tabs value={tab} onValueChange={setTab}>
      <TabsList className="w-full">
        <TabsTrigger value="all" className="flex-1">
          All ({citations.length + userCmts.length})
        </TabsTrigger>
        <TabsTrigger value="citations" className="flex-1">
          Citations ({citations.length})
        </TabsTrigger>
        <TabsTrigger value="comments" className="flex-1">
          Your Comments ({userCmts.length})
        </TabsTrigger>
      </TabsList>

      <TabsContent value="all" className="mt-4 space-y-3">
        {citations.map((c) => (
          <CitationComment key={c.id} comment={c} />
        ))}
        {userCmts.map((c) => (
          <UserComment key={c.id} comment={c} />
        ))}
        {citations.length === 0 && userCmts.length === 0 && (
          <p className="py-8 text-center text-sm text-muted-foreground">
            No comments yet for this paper.
          </p>
        )}
      </TabsContent>

      <TabsContent value="citations" className="mt-4 space-y-3">
        {citations.map((c) => (
          <CitationComment key={c.id} comment={c} />
        ))}
        {citations.length === 0 && (
          <p className="py-8 text-center text-sm text-muted-foreground">
            No citation comments yet.
          </p>
        )}
      </TabsContent>

      <TabsContent value="comments" className="mt-4 space-y-3">
        {userCmts.map((c) => (
          <UserComment key={c.id} comment={c} />
        ))}
        {userCmts.length === 0 && (
          <p className="py-8 text-center text-sm text-muted-foreground">
            No comments yet. Ask a question below!
          </p>
        )}
      </TabsContent>
    </Tabs>
  );
}
