"use client";

import { cn } from "@/lib/utils";
import { useI18n } from "@/components/shared/i18n-provider";

export function StatusDot({ status }: { status: string }) {
  const { t } = useI18n();
  const map: Record<string, { color: string; label: string }> = {
    online: { color: "bg-emerald-500", label: t.status.available },
    demo: { color: "bg-amber-400", label: t.status.demo },
    "dry-run": { color: "bg-amber-400", label: t.status.dryRun },
    unavailable: { color: "bg-red-500", label: t.status.unavailable },
    error: { color: "bg-red-500", label: t.status.error },
  };
  const item = map[status] ?? map.demo;
  return (
    <span className="inline-flex items-center gap-2">
      <span className={cn("size-2.5 rounded-full", item.color)} />
      <span className="text-[11px] text-slate-400">{item.label}</span>
    </span>
  );
}
