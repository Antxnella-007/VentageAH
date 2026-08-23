import { NextResponse } from "next/server";
import { getHealth } from "@/lib/dashboard";
import { ensureDb } from "@/lib/ensure-db";
import { useMemoryLedger } from "@/lib/runtime";

export const runtime = "nodejs";

export async function GET() {
  if (!useMemoryLedger()) {
    try {
      await ensureDb();
    } catch (error) {
      console.error("Health database check failed");
    }
  }
  const health = await getHealth();
  return NextResponse.json(health);
}
