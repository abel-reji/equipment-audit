import { NextResponse } from "next/server";
import { z } from "zod";

import { requireSessionAccount } from "@/lib/account";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const patchSchema = z.object({
  customerId: z.string().uuid().optional(),
  name: z.string().min(2).max(120).optional(),
  address: z.string().max(200).optional(),
  areaUnit: z.string().max(120).optional(),
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
    if (body.customerId !== undefined) {
      payload.customer_id = body.customerId;
    }
    if (body.name !== undefined) {
      payload.name = body.name;
    }
    if (body.address !== undefined) {
      payload.address = body.address || null;
    }
    if (body.areaUnit !== undefined) {
      payload.area_unit = body.areaUnit || null;
    }
    if (body.notes !== undefined) {
      payload.notes = body.notes || null;
    }

    const { error } = await supabase.from("sites").update(payload).eq("id", params.id);
    if (error) {
      throw error;
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to update site" },
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

    const { error } = await supabase.from("sites").delete().eq("id", params.id);
    if (error) {
      throw error;
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to delete site" },
      { status: 400 }
    );
  }
}
