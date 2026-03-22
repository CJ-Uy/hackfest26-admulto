"use client";

import { ShieldCheck, ShieldAlert, ChevronDown, ChevronUp } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

interface GroundingClaim {
  claim: string;
  entailment_score: number;
  passed: boolean;
}

interface GroundingPanelProps {
  data: {
    card_verified: boolean;
    claims: GroundingClaim[];
    summary: string;
  };
}

export function GroundingPanel({ data }: GroundingPanelProps) {
  const [expanded, setExpanded] = useState(false);
  const passedCount = data.claims.filter((c) => c.passed).length;

  return (
    <div
      className={cn(
        "mt-4 rounded-lg border p-4",
        data.card_verified
          ? "border-green-200 bg-green-50"
          : "border-amber-200 bg-amber-50",
      )}
    >
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center justify-between"
      >
        <div className="flex items-center gap-2">
          {data.card_verified ? (
            <ShieldCheck className="h-5 w-5 text-green-600" />
          ) : (
            <ShieldAlert className="h-5 w-5 text-amber-600" />
          )}
          <div className="text-left">
            <p
              className={cn(
                "text-[14px] font-semibold",
                data.card_verified ? "text-green-800" : "text-amber-800",
              )}
            >
              {data.card_verified ? "Verified" : "Partially Verified"}
            </p>
            <p
              className={cn(
                "text-[12px]",
                data.card_verified ? "text-green-700" : "text-amber-700",
              )}
            >
              {passedCount}/{data.claims.length} claims grounded in source
            </p>
          </div>
        </div>
        {expanded ? (
          <ChevronUp className="text-muted-foreground h-4 w-4" />
        ) : (
          <ChevronDown className="text-muted-foreground h-4 w-4" />
        )}
      </button>

      {expanded && (
        <div className="mt-3 space-y-2">
          {data.claims.map((claim, i) => (
            <div
              key={i}
              className={cn(
                "rounded-md border px-3 py-2",
                claim.passed
                  ? "bg-background border-green-200"
                  : "bg-background border-amber-200",
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <p className="text-foreground text-[13px]">{claim.claim}</p>
                <span
                  className={cn(
                    "shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium",
                    claim.passed
                      ? "bg-green-100 text-green-700"
                      : "bg-amber-100 text-amber-700",
                  )}
                >
                  {Math.round(claim.entailment_score * 100)}%
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
