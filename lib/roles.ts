import { cookies } from "next/headers";
import {
  ROLE_COOKIE,
  demoRoleSchema,
  type DemoRole,
} from "@/lib/roles-shared";

export * from "@/lib/roles-shared";

export async function getCurrentRole(): Promise<DemoRole> {
  const store = await cookies();
  const value = store.get(ROLE_COOKIE)?.value;
  const parsed = demoRoleSchema.safeParse(value);
  return parsed.success ? parsed.data : "Finance Analyst";
}
