import { execFileSync } from "node:child_process";
import path from "node:path";
import { prisma, resolveDatabaseUrl } from "@/lib/db";
import { useMemoryLedger } from "@/lib/runtime";

let ready = false;

export async function ensureDb() {
  if (useMemoryLedger()) return;
  if (ready) return;
  try {
    await prisma.company.findMany({ take: 1 });
    ready = true;
    return;
  } catch {
    const bin = path.join(process.cwd(), "node_modules", ".bin", "prisma");
    execFileSync(bin, ["db", "push", "--skip-generate"], {
      env: { ...process.env, DATABASE_URL: resolveDatabaseUrl() },
      stdio: "pipe",
    });
    await prisma.company.findMany({ take: 1 });
    ready = true;
  }
}
