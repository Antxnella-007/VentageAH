"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  FileText,
  Landmark,
  ScrollText,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { StatusDot } from "@/components/shared/status-dot";
import type { HealthResponse } from "@/types";

const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/invoices", label: "Invoices", icon: FileText },
  { href: "/treasury", label: "Treasury", icon: Landmark },
  { href: "/audit", label: "Audit Log", icon: ScrollText },
];

export function Sidebar({ health }: { health: HealthResponse | null }) {
  const pathname = usePathname();

  return (
    <aside className="flex h-full w-[248px] shrink-0 flex-col bg-navy text-sidebar-foreground">
      <div className="border-b border-white/10 px-5 py-6">
        <p className="text-[11px] font-semibold tracking-[0.28em] text-white">VANTAGE</p>
        <p className="mt-1 text-xs leading-5 text-slate-300">Enterprise Treasury Intelligence</p>
      </div>
      <nav className="flex-1 space-y-1 px-3 py-4">
        {NAV.map((item) => {
          const active = pathname === item.href;
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2.5 text-sm transition-colors",
                active
                  ? "bg-white/10 font-medium text-white"
                  : "text-slate-300 hover:bg-white/5 hover:text-white",
              )}
            >
              <Icon className="size-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="space-y-3 border-t border-white/10 px-5 py-5 text-xs">
        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">
          Local services
        </p>
        <ServiceRow label="QVAC Local AI" status={health?.qvac ?? "demo"} />
        <ServiceRow label="WDK Treasury" status={health?.wdk ?? "dry-run"} />
      </div>
    </aside>
  );
}

function ServiceRow({
  label,
  status,
}: {
  label: string;
  status: string;
}) {
  return (
    <div className="flex items-center justify-between text-slate-200">
      <span>{label}</span>
      <StatusDot status={status} />
    </div>
  );
}
