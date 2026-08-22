import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { ROLE_COOKIE, demoRoleSchema } from "@/lib/roles";

export async function GET() {
  const store = await cookies();
  const parsed = demoRoleSchema.safeParse(store.get(ROLE_COOKIE)?.value);
  return NextResponse.json({
    role: parsed.success ? parsed.data : "Finance Analyst",
  });
}

export async function POST(request: Request) {
  const body = (await request.json()) as { role?: string };
  const parsed = demoRoleSchema.safeParse(body.role);
  if (!parsed.success) {
    return NextResponse.json({ error: "Unexpected role value." }, { status: 400 });
  }
  const response = NextResponse.json({ role: parsed.data });
  response.cookies.set(ROLE_COOKIE, parsed.data, { path: "/", httpOnly: false });
  return response;
}
