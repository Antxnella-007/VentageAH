import { NextResponse } from "next/server";

export function jsonError(message: string, status = 500) {
  return NextResponse.json({ error: message }, { status });
}

export function publicErrorMessage(error: unknown) {
  const raw = error instanceof Error ? error.message : "Request failed.";
  if (/GEMINI_API_KEY|AQ\.|AIza/i.test(raw)) return "A server configuration error occurred.";
  if (/prisma|database|sqlite|unable to open/i.test(raw)) return "Database is unavailable.";
  return raw.slice(0, 180);
}
