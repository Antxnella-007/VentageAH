import { NextResponse } from "next/server";
import { getHealth } from "@/lib/dashboard";
import { ensureDb } from "@/lib/ensure-db";

export async function GET() {
  try {
    await ensureDb();
  } catch {
    // Health still reports whatever getHealth can see.
  }
  const health = await getHealth();
  return NextResponse.json(health);
}

export async function GET() {
  const health = await getHealth();
  return NextResponse.json(health);
}
