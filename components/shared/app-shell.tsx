"use client";

import { useEffect, useState } from "react";
import { Sidebar } from "@/components/shared/sidebar";
import { TopBar } from "@/components/shared/top-bar";
import { Toaster } from "@/components/ui/sonner";
import type { DemoRole } from "@/lib/roles-shared";
import type { HealthResponse } from "@/types";

export function AppShell({
  children,
  initialRole,
  initialHealth,
}: {
  children: React.ReactNode;
  initialRole: DemoRole;
  initialHealth: HealthResponse;
}) {
  const [role, setRole] = useState<DemoRole>(initialRole);
  const [health, setHealth] = useState<HealthResponse>(initialHealth);

  useEffect(() => {
    const timer = setInterval(() => {
      fetch("/api/health")
        .then((res) => res.json())
        .then((data: HealthResponse) => setHealth(data))
        .catch(() => undefined);
    }, 8000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar health={health} />
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar
          role={role}
          environment={health.environment}
          onRoleChange={setRole}
        />
        <main className="flex-1 overflow-auto p-6">{children}</main>
      </div>
      <Toaster />
    </div>
  );
}
