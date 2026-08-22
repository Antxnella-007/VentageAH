import { NextResponse } from "next/server";
import { getHealth } from "@/lib/dashboard";

export async function GET() {
  const health = await getHealth();
  return NextResponse.json(health);
}
