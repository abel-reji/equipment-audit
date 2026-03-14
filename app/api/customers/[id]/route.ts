import { NextResponse } from "next/server";
import { z } from "zod";

import { requireSessionAccount } from "@/lib/account";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const patchSchema = z.object({
  name: z.string().min(2).max(120).optional(),
  notes: z.string().max(500).optional()
});

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const body = patchSchema.parse(await request.json());
    const supabase = createServerSupabaseClient();
    await requireSessionAccount(supabase);

    const payload: Record<string, string | null> = {};
    if (body.name !== undefined) {
      payload.name = body.name;
    }
    if (body.notes !== undefined) {
      payload.notes = body.notes || null;
    }

    const { error } = await supabase.from("customers").update(payload).eq("id", params.id);
    if (error) {
      throw error;
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to update customer" },
      { status: 400 }
    );
  }
}

export async function DELETE(
  _: Request,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createServerSupabaseClient();
    await requireSessionAccount(supabase);

    const { error } = await supabase.from("customers").delete().eq("id", params.id);
    if (error) {
      throw error;
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to delete customer" },
      { status: 400 }
    );
  }
}

