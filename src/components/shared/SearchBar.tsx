"use client";

import { Search } from "lucide-react";

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  mobileTopPaddingClass?: string;
}

export function SearchBar({
  value,
  onChange,
  mobileTopPaddingClass = "pt-8",
}: SearchBarProps) {
  return (
    <div className={`px-4 py-2 ${mobileTopPaddingClass} md:pt-2`}>
      <div className="relative">
        <Search className="text-muted-foreground absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2" />
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Search"
          className="border-border text-foreground placeholder:text-muted-foreground focus:border-primary bg-subtle focus:bg-background h-10 w-full rounded-full border pr-4 pl-10 text-[15px] focus:outline-none"
        />
      </div>
    </div>
  );
}
