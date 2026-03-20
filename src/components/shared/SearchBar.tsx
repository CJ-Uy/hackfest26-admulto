"use client";

import { Search } from "lucide-react";

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
}

export function SearchBar({ value, onChange }: SearchBarProps) {
  return (
    <div className="px-4 py-2">
      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Search"
          className="h-10 w-full rounded-full border border-border bg-[#f6f7f8] pl-10 pr-4 text-[15px] text-foreground placeholder:text-muted-foreground focus:border-primary focus:bg-white focus:outline-none"
        />
      </div>
    </div>
  );
}
