"use client";

import { Badge } from "@/components/ui/badge";
import { RoleSwitcher } from "@/components/shared/role-switcher";
import { ROLE_ACTORS, type DemoRole } from "@/lib/roles-shared";
import { useI18n } from "@/components/shared/i18n-provider";

export function TopBar({
  role,
  environment,
  onRoleChange,
}: {
  role: DemoRole;
  environment: "Demo" | "Live";
  onRoleChange: (role: DemoRole) => void;
}) {
  const { t } = useI18n();
  return (
    <header className="flex min-h-16 items-center justify-between gap-4 border-b border-border bg-white px-6 py-3">
      <div>
        <p className="text-sm font-medium text-foreground">{t.company}</p>
        <p className="text-xs text-muted-foreground">
          {ROLE_ACTORS[role].name} · {t.roles[role]}
        </p>
      </div>
      <div className="flex flex-wrap items-center justify-end gap-3">
        <Badge variant={environment === "Demo" ? "secondary" : "default"}>
          {t.environment}: {environment === "Demo" ? t.demo : t.live}
        </Badge>
        <RoleSwitcher role={role} onChange={onRoleChange} />
      </div>
    </header>
  );
}
