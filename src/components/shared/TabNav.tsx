"use client";

import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface TabNavProps {
  value: string;
  onValueChange: (value: string) => void;
  tabs: { value: string; label: string; description?: string }[];
}

export function TabNav({ value, onValueChange, tabs }: TabNavProps) {
  return (
    <div className="mx-auto max-w-[680px] px-4">
      <Tabs value={value} onValueChange={onValueChange}>
        <TabsList className="w-full">
          {tabs.map((tab) => (
            <TabsTrigger key={tab.value} value={tab.value} className="flex-1">
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
      {tabs.map((tab) =>
        tab.value === value && tab.description ? (
          <p
            key={tab.value}
            className="mt-2 text-center text-xs text-muted-foreground"
          >
            {tab.description}
          </p>
        ) : null
      )}
    </div>
  );
}
