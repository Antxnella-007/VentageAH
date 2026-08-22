"use client";

import { cn } from "@/lib/utils";

const MAP: Record<string, { color: string; label: string }> = {
  online: { color: "bg-emerald-500", label: "Available" },
  demo: { color: "bg-amber-400", label: "Demo mode" },
  "dry-run": { color: "bg-amber-400", label: "Dry run" },
  unavailable: { color: "bg-red-500", label: "Unavailable" },
  error: { color: "bg-red-500", label: "Error" },
};

export function StatusDot({ status }: { status: string }) {
  const item = MAP[status] ?? MAP.demo;
  return (
    <span className="inline-flex items-center gap-2">
      <span className={cn("size-2 rounded-full", item.color)} />
      <span className="text-[11px] text-slate-400">{item.label}</span>
    </span>
  );
}
