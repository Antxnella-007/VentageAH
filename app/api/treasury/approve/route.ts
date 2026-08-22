import { NextResponse } from "next/server";
import { z } from "zod";
import { approveBatch } from "@/lib/approvals";
import { getCurrentRole } from "@/lib/roles";
import { batchIdSchema } from "@/lib/validators";

const bodySchema = z.object({
  batchId: batchIdSchema,
});

export async function POST(request: Request) {
  const parsed = bodySchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "A valid batch id is required." }, { status: 400 });
  }

  try {
    const role = await getCurrentRole();
    const batch = await approveBatch({ batchId: parsed.data.batchId, role });
    return NextResponse.json({
      id: batch.id,
      status: batch.status,
      approvals: batch.approvals,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Approval could not be recorded.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
