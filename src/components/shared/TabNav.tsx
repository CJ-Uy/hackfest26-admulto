"use client";

import { cn } from "@/lib/utils";

interface TabNavProps {
  value: string;
  onValueChange: (value: string) => void;
  tabs: { value: string; label: string }[];
}

export function TabNav({ value, onValueChange, tabs }: TabNavProps) {
  return (
    <div className="flex">
      {tabs.map((tab) => (
        <button
          key={tab.value}
          onClick={() => onValueChange(tab.value)}
          className={cn(
            "flex-1 py-3 text-center text-[15px] font-semibold transition-colors relative",
            value === tab.value
              ? "text-foreground"
              : "text-muted-foreground hover:text-foreground hover:bg-[#f6f7f8]"
          )}
        >
          {tab.label}
          {value === tab.value && (
            <div className="absolute bottom-0 left-1/2 -translate-x-1/2 h-[3px] w-16 rounded-full bg-primary" />
          )}
        </button>
      ))}
    </div>
  );
}
