"use client";

import Link from "next/link";
import { Plus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SchrollarLogo } from "./SchrollarLogo";

interface NavbarProps {
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  searchPlaceholder?: string;
}

export function Navbar({
  searchValue,
  onSearchChange,
  searchPlaceholder = "Search Schrollar",
}: NavbarProps) {
  return (
    <header className="bg-background border-b border-[var(--navbar-border)] sticky top-0 z-50 hidden md:block">
      <div className="flex h-12 items-center gap-4 px-5">
        {/* Left: Logo */}
        <Link href="/" className="shrink-0">
          <SchrollarLogo className="text-primary" size="sm" />
        </Link>

        {/* Center: Search */}
        <div className="flex flex-1 justify-center">
          <div className="relative w-full max-w-[540px]">
            <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
            <input
              type="text"
              value={searchValue ?? ""}
              onChange={(e) => onSearchChange?.(e.target.value)}
              placeholder={searchPlaceholder}
              className="bg-subtle hover:bg-subtle-hover border-border text-foreground placeholder:text-muted-foreground focus:border-primary focus:bg-background h-9 w-full rounded-full border pr-4 pl-9 text-[14px] transition-colors focus:outline-none"
            />
          </div>
        </div>

        {/* Right: Create + Profile */}
        <div className="flex shrink-0 items-center gap-2">
          <Link href="/onboarding">
            <Button variant="ghost" size="sm" className="gap-1.5 text-[14px]">
              <Plus className="h-4 w-4" />
              Create
            </Button>
          </Link>
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#2b4ac7] text-[13px] font-bold text-white">
            S
          </div>
        </div>
      </div>
    </header>
  );
}
