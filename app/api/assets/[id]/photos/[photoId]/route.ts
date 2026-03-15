import { NextResponse } from "next/server";

import { requireSessionAccount } from "@/lib/account";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function DELETE(
  _: Request,
  { params }: { params: { id: string; photoId: string } }
) {
  try {
    const supabase = createServerSupabaseClient();
    await requireSessionAccount(supabase);

    const { data: photo, error: loadError } = await supabase
      .from("asset_photos")
      .select("storage_path")
      .eq("asset_id", params.id)
      .eq("id", params.photoId)
      .single();

    if (loadError || !photo) {
      throw new Error(loadError?.message ?? "Photo not found");
    }

    const { error: storageError } = await supabase
      .storage
      .from("asset-photos")
      .remove([photo.storage_path]);

    if (storageError) {
      throw storageError;
    }

    const { error: deleteError } = await supabase
      .from("asset_photos")
      .delete()
      .eq("asset_id", params.id)
      .eq("id", params.photoId);

    if (deleteError) {
      throw deleteError;
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to delete photo" },
      { status: 400 }
    );
  }
}
