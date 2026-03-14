import { NextResponse } from "next/server";
import { z } from "zod";

import { requireSessionAccount } from "@/lib/account";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const photoPayloadSchema = z.object({
  id: z.string().min(1),
  localDraftId: z.string().min(1),
  photoType: z.enum([
    "equipment-tag",
    "motor-tag",
    "coupling",
    "equipment",
    "piping-context",
    "other"
  ]),
  storagePath: z.string().min(1)
});

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const body = photoPayloadSchema.parse(await request.json());
    const supabase = createServerSupabaseClient();
    const { account } = await requireSessionAccount(supabase);

    const { error } = await supabase.from("asset_photos").upsert(
      {
        account_id: account.id,
        asset_id: params.id,
        client_uid: body.id,
        local_draft_id: body.localDraftId,
        photo_type: body.photoType,
        storage_path: body.storagePath,
        captured_at: new Date().toISOString()
      },
      { onConflict: "account_id,client_uid" }
    );

    if (error) {
      throw error;
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to save photo metadata" },
      { status: 400 }
    );
  }
}
