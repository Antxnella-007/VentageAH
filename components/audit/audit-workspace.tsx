"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatTime } from "@/lib/format";
import { auditCategory } from "@/lib/audit-categories";
import { useI18n } from "@/components/shared/i18n-provider";

type Log = {
  id: string;
  eventType: string;
  actor: string;
  actorRole: string;
  description: string;
  entityType: string | null;
  createdAt: string;
};

const FILTERS = ["All", "Invoices", "Treasury", "Security", "AI"] as const;

export function AuditWorkspace({ initialLogs }: { initialLogs: Log[] }) {
  const { t } = useI18n();
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("All");
  const logs = useMemo(
    () =>
      initialLogs.filter((log) => filter === "All" || auditCategory(log.eventType) === filter),
    [filter, initialLogs],
  );

  const labels: Record<(typeof FILTERS)[number], string> = {
    All: t.audit.all,
    Invoices: t.audit.invoices,
    Treasury: t.audit.treasury,
    Security: t.audit.security,
    AI: t.audit.ai,
  };

  return (
    <div className="space-y-6">
      <div className="max-w-3xl">
        <h1 className="text-2xl font-semibold tracking-tight">{t.audit.title}</h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">{t.audit.intro}</p>
      </div>
      <div className="flex flex-wrap gap-2">
        {FILTERS.map((item) => (
          <Button
            key={item}
            size="sm"
            variant={filter === item ? "default" : "outline"}
            onClick={() => setFilter(item)}
          >
            {labels[item]}
          </Button>
        ))}
      </div>
      <Card>
        <CardHeader>
          <CardTitle>{t.audit.timeline}</CardTitle>
        </CardHeader>
        <CardContent>
          {logs.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t.audit.empty}</p>
          ) : (
            <ol className="space-y-5">
              {logs.map((log) => (
                <li key={log.id} className="grid grid-cols-[64px_1fr] gap-4">
                  <p className="font-mono text-sm text-muted-foreground">{formatTime(log.createdAt)}</p>
                  <div>
                    <p className="font-medium">
                      {(t.events as Record<string, string>)[log.eventType] ?? log.eventType.replaceAll("_", " ")}
                    </p>
                    <p className="text-sm text-muted-foreground">{log.description}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {log.actor} · {log.actorRole}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
