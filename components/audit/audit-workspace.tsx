"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatTime } from "@/lib/format";
import { auditCategory } from "@/lib/audit-categories";

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
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("All");
  const logs = useMemo(
    () =>
      initialLogs.filter((log) => filter === "All" || auditCategory(log.eventType) === filter),
    [filter, initialLogs],
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Audit Log</h1>
        <p className="text-sm text-muted-foreground">
          Immutable-style activity trail for invoice intelligence, approvals, and treasury execution.
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        {FILTERS.map((item) => (
          <Button
            key={item}
            size="sm"
            variant={filter === item ? "default" : "outline"}
            onClick={() => setFilter(item)}
          >
            {item}
          </Button>
        ))}
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Activity timeline</CardTitle>
        </CardHeader>
        <CardContent>
          {logs.length === 0 ? (
            <p className="text-sm text-muted-foreground">No audit events match this filter.</p>
          ) : (
            <ol className="space-y-5">
              {logs.map((log) => (
                <li key={log.id} className="grid grid-cols-[64px_1fr] gap-4">
                  <p className="font-mono text-sm text-muted-foreground">{formatTime(log.createdAt)}</p>
                  <div>
                    <p className="font-medium">{titleFor(log.eventType)}</p>
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

function titleFor(eventType: string) {
  const map: Record<string, string> = {
    INVOICE_BATCH_UPLOADED: "Invoice batch uploaded",
    INVOICE_PROCESSING_STARTED: "QVAC processing started",
    INVOICE_PROCESSED: "QVAC processing complete",
    INVOICE_FLAGGED: "Invoice flagged",
    ANOMALY_DETECTED: "Anomaly detected",
    PAYMENT_BATCH_CREATED: "Payment batch created",
    PAYMENT_BATCH_APPROVED: "Approval recorded",
    APPROVAL_THRESHOLD_REACHED: "Approval threshold reached",
    PAYMENT_EXECUTION_STARTED: "WDK payment execution started",
    PAYMENT_PREVIEWED: "Payment previewed",
    PAYMENT_CONFIRMED: "Payment confirmed",
    PAYMENT_FAILED: "Payment failed",
    PAYMENT_BATCH_COMPLETED: "Payment batch completed",
  };
  return map[eventType] ?? eventType.replaceAll("_", " ");
}
