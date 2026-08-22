"use client";

import { Badge } from "@/components/ui/badge";
import { RoleSwitcher } from "@/components/shared/role-switcher";
import { ROLE_ACTORS, type DemoRole } from "@/lib/roles-shared";

export function TopBar({
  role,
  environment,
  onRoleChange,
}: {
  role: DemoRole;
  environment: "Demo" | "Live";
  onRoleChange: (role: DemoRole) => void;
}) {
  return (
    <header className="flex h-16 items-center justify-between border-b border-border bg-white px-6">
      <div>
        <p className="text-sm font-medium text-foreground">Company: Vantage Holdings</p>
        <p className="text-xs text-muted-foreground">
          {ROLE_ACTORS[role].name} · {role}
        </p>
      </div>
      <div className="flex items-center gap-3">
        <Badge variant={environment === "Demo" ? "secondary" : "default"}>
          Environment: {environment}
        </Badge>
        <RoleSwitcher role={role} onChange={onRoleChange} />
      </div>
    </header>
  );
}
