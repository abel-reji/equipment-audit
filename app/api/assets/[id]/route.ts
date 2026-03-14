import { NextResponse } from "next/server";
import { z } from "zod";

import { requireSessionAccount } from "@/lib/account";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function GET(
  _: Request,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createServerSupabaseClient();
    await requireSessionAccount(supabase);

    const { data: asset, error: assetError } = await supabase
      .from("assets")
      .select("*, sites(*, customers(*))")
      .eq("id", params.id)
      .single();

    if (assetError || !asset) {
      throw new Error(assetError?.message ?? "Asset not found");
    }

    const { data: photos, error: photoError } = await supabase
      .from("asset_photos")
      .select("*")
      .eq("asset_id", params.id)
      .order("captured_at", { ascending: false });

    if (photoError) {
      throw photoError;
    }

    const withSignedUrls = await Promise.all(
      (photos ?? []).map(async (photo) => {
        const { data } = await supabase.storage
          .from("asset-photos")
          .createSignedUrl(photo.storage_path, 60 * 60);

        return {
          ...photo,
          signedUrl: data?.signedUrl
        };
      })
    );

    return NextResponse.json({
      asset,
      site: asset.sites,
      customer: asset.sites?.customers,
      photos: withSignedUrls
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to load asset" },
      { status: 400 }
    );
  }
}

const patchSchema = z.object({
  captureStatus: z
    .enum(["local-only", "queued", "syncing", "partial", "synced", "failed"])
    .optional(),
  siteId: z.string().uuid().optional(),
  equipmentType: z
    .enum(["pump", "compressor", "motor", "gearbox", "fan", "blower", "other"])
    .optional(),
  equipmentTag: z.string().max(120).optional(),
  manufacturer: z.string().max(120).optional(),
  temporaryIdentifier: z.string().max(120).optional(),
  quickNote: z.string().max(800).optional()
});

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const body = patchSchema.parse(await request.json());
    const supabase = createServerSupabaseClient();
    await requireSessionAccount(supabase);

    const updatePayload: Record<string, string | null> = {};

    if (body.captureStatus) {
      updatePayload.capture_status = body.captureStatus;
    }
    if (body.siteId) {
      updatePayload.site_id = body.siteId;
    }
    if (body.equipmentType) {
      updatePayload.equipment_type = body.equipmentType;
    }
    if (body.equipmentTag !== undefined) {
      updatePayload.equipment_tag = body.equipmentTag || null;
    }
    if (body.manufacturer !== undefined) {
      updatePayload.manufacturer = body.manufacturer || null;
    }
    if (body.temporaryIdentifier !== undefined) {
      updatePayload.temporary_identifier = body.temporaryIdentifier || null;
    }
    if (body.quickNote !== undefined) {
      updatePayload.quick_note = body.quickNote || null;
    }

    const { error } = await supabase
      .from("assets")
      .update(updatePayload)
      .eq("id", params.id);

    if (error) {
      throw error;
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to update asset" },
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

    const { data: photos, error: photoLoadError } = await supabase
      .from("asset_photos")
      .select("storage_path")
      .eq("asset_id", params.id);

    if (photoLoadError) {
      throw photoLoadError;
    }

    if (photos?.length) {
      const { error: storageError } = await supabase.storage
        .from("asset-photos")
        .remove(photos.map((photo) => photo.storage_path));

      if (storageError) {
        throw storageError;
      }
    }

    const { error } = await supabase.from("assets").delete().eq("id", params.id);

    if (error) {
      throw error;
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to delete asset" },
      { status: 400 }
    );
  }
}
