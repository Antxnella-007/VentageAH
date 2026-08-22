import { NextResponse } from "next/server";
import { getDashboardPayload } from "@/lib/dashboard";

export async function GET() {
  const payload = await getDashboardPayload();
  return NextResponse.json(payload);
}
