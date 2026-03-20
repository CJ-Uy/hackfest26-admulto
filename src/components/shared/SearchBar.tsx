"use client";

import { Search } from "lucide-react";

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
}

export function SearchBar({ value, onChange }: SearchBarProps) {
  return (
    <div className="px-4 py-1.5">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Search"
          className="h-8 w-full rounded-full border border-border bg-[#f6f7f8] pl-9 pr-4 text-[13px] text-foreground placeholder:text-muted-foreground focus:border-primary focus:bg-white focus:outline-none"
        />
      </div>
    </div>
  );
}
