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

export function RoleSwitcher({
  role,
  onChange,
}: {
  role: DemoRole;
  onChange: (role: DemoRole) => void;
}) {
  const [pending, start] = useTransition();

  return (
    <div className="flex items-center gap-2">
      <span className="hidden text-xs text-muted-foreground sm:inline">Acting as</span>
      <Select
        value={role}
        disabled={pending}
        onValueChange={(value) => {
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
        <SelectTrigger size="sm" className="min-w-44 bg-white">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {DEMO_ROLES.map((item) => (
            <SelectItem key={item} value={item}>
              {item}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
