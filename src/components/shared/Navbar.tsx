"use client";

import Link from "next/link";
import { Plus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SchrollarLogo } from "./SchrollarLogo";

interface NavbarProps {
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  searchPlaceholder?: string;
  showMobile?: boolean;
}

export function Navbar({
  searchValue,
  onSearchChange,
  searchPlaceholder = "Search Schrollar",
  showMobile = false,
}: NavbarProps) {
  if (showMobile) {
    return (
      <header className="bg-background sticky top-0 z-40 border-b border-(--navbar-border) md:hidden">
        <div className="flex h-14 items-center gap-3 px-4">
          <Link href="/" className="shrink-0">
            <SchrollarLogo className="text-primary" size="sm" />
          </Link>

          <div className="min-w-0 flex-1">
            <div className="relative">
              <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
              <input
                type="text"
                value={searchValue ?? ""}
                onChange={(e) => onSearchChange?.(e.target.value)}
                placeholder={searchPlaceholder}
                className="bg-subtle hover:bg-subtle-hover border-primary/30 text-foreground placeholder:text-muted-foreground focus:border-primary focus:bg-background h-9 w-full rounded-full border pr-4 pl-9 text-[14px] transition-all focus:shadow-[0_0_0_3px_rgba(74,108,247,0.15)] focus:outline-none"
              />
            </div>
          </div>
        </div>
      </header>
    );
  }

  return (
    <header className="bg-background sticky top-0 z-50 hidden border-b border-(--navbar-border) md:block">
      <div className="flex h-14 items-center gap-4 px-5">
        {/* Left: Logo */}
        <Link href="/" className="shrink-0">
          <SchrollarLogo className="text-primary" size="sm" />
        </Link>

        {/* Center: Search */}
        <div className="flex flex-1 justify-center">
          <div className="relative w-full max-w-135">
            <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
            <input
              type="text"
              value={searchValue ?? ""}
              onChange={(e) => onSearchChange?.(e.target.value)}
              placeholder={searchPlaceholder}
              className="bg-subtle hover:bg-subtle-hover border-primary/30 text-foreground placeholder:text-muted-foreground focus:border-primary focus:bg-background h-10 w-full rounded-full border pr-4 pl-9 text-[14px] transition-all focus:shadow-[0_0_0_3px_rgba(74,108,247,0.15)] focus:outline-none"
            />
          </div>
        </div>

        {/* Right: Create + Profile */}
        <div className="flex shrink-0 items-center gap-3">
          <Link href="/onboarding">
            <Button
              size="sm"
              className="bg-primary text-primary-foreground hover:bg-primary/90 gap-1.5 rounded-full px-4 text-[14px]"
            >
              <Plus className="h-4 w-4" />
              Create
            </Button>
          </Link>
          <div className="bg-primary flex h-8 w-8 items-center justify-center rounded-full">
            <SchrollarLogo
              showText={false}
              size="sm"
              className="text-primary-foreground"
            />
          </div>
        </div>
      </div>
    </header>
  );
}
