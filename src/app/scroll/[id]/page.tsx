"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { Sidebar } from "@/components/shared/Sidebar";
import { ScrollHeader } from "@/components/shared/ScrollHeader";
import { TabNav } from "@/components/shared/TabNav";
import { FeedView } from "@/components/feed/FeedView";
import { PollsView } from "@/components/polls/PollsView";
import { ExportView } from "@/components/export/ExportView";
import { scrollSessions as mockScrollSessions } from "@/lib/data/scrolls";
import { fetchScroll } from "@/lib/scroll-store";
import type { ScrollSession } from "@/lib/types";

const TABS = [
  {
    value: "feed",
    label: "Feed",
    description:
      "AI-curated research papers based on your topic. Interact to refine your feed.",
  },
  {
    value: "polls",
    label: "Polls",
    description:
      "Help curate the feed \u2014 your responses improve AI recommendations.",
  },
  {
    value: "export",
    label: "Export",
    description:
      "Export your structured citations and research outline.",
  },
];

export default function ScrollPage() {
  const params = useParams();
  const scrollId = params.id as string;
  const [activeTab, setActiveTab] = useState("feed");
  const [scroll, setScroll] = useState<ScrollSession | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const stored = await fetchScroll(scrollId);
      if (cancelled) return;

      if (stored) {
        setScroll(stored.scroll);
      } else {
        const mock =
          mockScrollSessions.find((s) => s.id === scrollId) ??
          mockScrollSessions[0];
        setScroll(mock);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [scrollId]);

  if (!scroll) return null;

  return (
    <div className="flex min-h-screen">
      <Sidebar />

      <main className="flex-1">
        <ScrollHeader scroll={scroll} />

        <div className="py-4">
          <TabNav
            value={activeTab}
            onValueChange={setActiveTab}
            tabs={TABS}
          />
        </div>

        <div className="pb-12">
          {activeTab === "feed" && <FeedView scrollId={scrollId} />}
          {activeTab === "polls" && <PollsView />}
          {activeTab === "export" && <ExportView scrollId={scrollId} />}
        </div>
      </main>
    </div>
  );
}
