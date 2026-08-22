import path from "node:path";
import { PrismaClient } from "@prisma/client";

function resolveDatabaseUrl() {
  const raw = process.env.DATABASE_URL ?? "file:./dev.db";
  if (!raw.startsWith("file:")) return raw;
  const filePath = raw.slice("file:".length);
  if (path.isAbsolute(filePath)) return raw;
  if (process.env.VERCEL) return `file:${path.join("/tmp", path.basename(filePath))}`;
  return `file:${path.join(process.cwd(), "prisma", path.basename(filePath))}`;
}

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    datasources: { db: { url: resolveDatabaseUrl() } },
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
