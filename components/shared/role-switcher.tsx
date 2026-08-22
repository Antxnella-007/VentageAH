"use client";

import { useTransition } from "react";
import { DEMO_ROLES, type DemoRole } from "@/lib/roles-shared";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useI18n } from "@/components/shared/i18n-provider";

export function RoleSwitcher({
  role,
  onChange,
}: {
  role: DemoRole;
  onChange: (role: DemoRole) => void;
}) {
  const [pending, start] = useTransition();
  const { t } = useI18n();

  return (
    <div className="flex items-center gap-2">
      <span className="hidden text-xs text-muted-foreground sm:inline">{t.actingAs}</span>
      <Select
        value={role}
        disabled={pending}
        onValueChange={(value) => {
          if (!value) return;
          start(async () => {
            const next = value as DemoRole;
            await fetch("/api/role", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ role: next }),
            });
            onChange(next);
          });
        }}
      >
        <SelectTrigger size="sm" className="min-w-48 bg-white">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {DEMO_ROLES.map((item) => (
            <SelectItem key={item} value={item}>
              {t.roles[item]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
