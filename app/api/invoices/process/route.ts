import { NextResponse } from "next/server";
import { z } from "zod";
import { processInvoiceIds } from "@/lib/invoice-processor";
import { actorFor, getCurrentRole } from "@/lib/roles";

const bodySchema = z.object({
  ids: z.array(z.string().min(1)).min(1).max(30),
});

export async function POST(request: Request) {
  const json = await request.json();
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "A valid list of invoice ids is required." }, { status: 400 });
  }

  const actor = actorFor(await getCurrentRole());
  await processInvoiceIds(parsed.data.ids, actor);
  return NextResponse.json({ ok: true, processed: parsed.data.ids.length });
}
