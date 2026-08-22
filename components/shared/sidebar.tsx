"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { FileText, LayoutDashboard, ScrollText } from "lucide-react";
import { cn } from "@/lib/utils";
import { StatusDot } from "@/components/shared/status-dot";
import { LanguageSwitcher } from "@/components/shared/language-switcher";
import { useI18n } from "@/components/shared/i18n-provider";
import type { HealthResponse } from "@/types";

export function Sidebar({ health }: { health: HealthResponse | null }) {
  const pathname = usePathname();
  const { t } = useI18n();

  const nav = [
    { href: "/invoices", label: t.nav.invoices, hint: t.nav.invoicesHint, icon: FileText },
    { href: "/dashboard", label: t.nav.dashboard, hint: t.nav.dashboardHint, icon: LayoutDashboard },
    { href: "/audit", label: t.nav.audit, hint: t.nav.auditHint, icon: ScrollText },
  ];

  return (
    <aside className="flex h-full w-[300px] shrink-0 flex-col bg-navy text-sidebar-foreground">
      <div className="border-b border-white/10 px-6 py-7">
        <p className="text-xs font-semibold tracking-[0.32em] text-white">{t.brand}</p>
        <p className="mt-2 text-sm leading-6 text-slate-300">{t.brandSub}</p>
      </div>
      <nav className="flex-1 space-y-2 px-4 py-5">
        {nav.map((item) => {
          const active = pathname === item.href;
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-start gap-3 rounded-xl px-3 py-3 transition-colors",
                active ? "bg-white/12 text-white" : "text-slate-300 hover:bg-white/10 hover:text-white",
              )}
            >
              <Icon className="mt-0.5 size-5 shrink-0" />
              <span>
                <span className="block text-[15px] font-medium">{item.label}</span>
                <span className="mt-0.5 block text-xs leading-5 text-slate-400">{item.hint}</span>
              </span>
            </Link>
          );
        })}
      </nav>
      <div className="space-y-4 border-t border-white/10 px-5 py-5">
        <LanguageSwitcher />
        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">
          {t.services}
        </p>
        <ServiceRow label={t.qvac} status={health?.gemini ?? health?.qvac ?? "demo"} />
        <ServiceRow label={t.wdk} status="online" />
      </div>
    </aside>
  );
}

function ServiceRow({ label, status }: { label: string; status: string }) {
  return (
    <div className="flex items-center justify-between text-sm text-slate-200">
      <span>{label}</span>
      <StatusDot status={status} />
    </div>
  );
}
