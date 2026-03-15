import { NextResponse } from "next/server";
import { z } from "zod";

import { requireSessionAccount } from "@/lib/account";
import { assetStatusOptions, equipmentTypeOptions } from "@/lib/constants";
import { createServerSupabaseClient } from "@/lib/supabase/server";

function hasValues(record?: Record<string, string | undefined>) {
  return Boolean(record && Object.values(record).some((value) => value && value.trim().length > 0));
}

function relationToSingle<T>(value: T | T[] | null | undefined) {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return value ?? null;
}

export async function GET(
  _: Request,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createServerSupabaseClient();
    await requireSessionAccount(supabase);

    const { data: asset, error: assetError } = await supabase
      .from("assets")
      .select("*, sites(*, customers(*)), asset_drivers(*), asset_couplings(*)")
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
      driver: relationToSingle(asset.asset_drivers),
      coupling: relationToSingle(asset.asset_couplings),
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
  equipmentType: z.enum(equipmentTypeOptions).optional(),
  equipmentTag: z.string().max(120).optional(),
  manufacturer: z.string().max(120).optional(),
  model: z.string().max(120).optional(),
  serial: z.string().max(120).optional(),
  serviceApplication: z.string().max(160).optional(),
  status: z.enum(assetStatusOptions).optional(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  locationAccuracyMeters: z.number().nonnegative().optional(),
  locationCapturedAt: z.string().datetime().optional(),
  temporaryIdentifier: z.string().max(120).optional(),
  quickNote: z.string().max(800).optional(),
  driver: z
    .object({
      motorOem: z.string().max(120).optional(),
      motorModel: z.string().max(120).optional(),
      hp: z.string().max(40).optional(),
      rpm: z.string().max(40).optional(),
      voltage: z.string().max(40).optional(),
      frame: z.string().max(40).optional()
    })
    .optional(),
  coupling: z
    .object({
      oem: z.string().max(120).optional(),
      couplingType: z.string().max(120).optional(),
      size: z.string().max(80).optional(),
      spacer: z.string().max(80).optional(),
      notes: z.string().max(500).optional()
    })
    .optional()
});

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const body = patchSchema.parse(await request.json());
    const supabase = createServerSupabaseClient();
    const { account } = await requireSessionAccount(supabase);

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
    if (body.model !== undefined) {
      updatePayload.model = body.model || null;
    }
    if (body.serial !== undefined) {
      updatePayload.serial = body.serial || null;
    }
    if (body.serviceApplication !== undefined) {
      updatePayload.service_application = body.serviceApplication || null;
    }
    if (body.status !== undefined) {
      updatePayload.status = body.status;
    }
    if (body.latitude !== undefined) {
      updatePayload.latitude = String(body.latitude);
    }
    if (body.longitude !== undefined) {
      updatePayload.longitude = String(body.longitude);
    }
    if (body.locationAccuracyMeters !== undefined) {
      updatePayload.location_accuracy_meters = String(body.locationAccuracyMeters);
    }
    if (body.locationCapturedAt !== undefined) {
      updatePayload.location_captured_at = body.locationCapturedAt;
    }
    if (body.temporaryIdentifier !== undefined) {
      updatePayload.temporary_identifier = body.temporaryIdentifier || null;
    }
    if (body.quickNote !== undefined) {
      updatePayload.quick_note = body.quickNote || null;
    }

    if (Object.keys(updatePayload).length > 0) {
      const { error } = await supabase
        .from("assets")
        .update(updatePayload)
        .eq("id", params.id);

      if (error) {
        throw error;
      }
    }

    if (body.driver !== undefined) {
      if (hasValues(body.driver)) {
        const { error: driverError } = await supabase.from("asset_drivers").upsert(
          {
            asset_id: params.id,
            account_id: account.id,
            motor_oem: body.driver.motorOem || null,
            motor_model: body.driver.motorModel || null,
            hp: body.driver.hp || null,
            rpm: body.driver.rpm || null,
            voltage: body.driver.voltage || null,
            frame: body.driver.frame || null
          },
          { onConflict: "asset_id" }
        );

        if (driverError) {
          throw driverError;
        }
      } else {
        const { error: driverDeleteError } = await supabase
          .from("asset_drivers")
          .delete()
          .eq("asset_id", params.id);

        if (driverDeleteError) {
          throw driverDeleteError;
        }
      }
    }

    if (body.coupling !== undefined) {
      if (hasValues(body.coupling)) {
        const { error: couplingError } = await supabase.from("asset_couplings").upsert(
          {
            asset_id: params.id,
            account_id: account.id,
            oem: body.coupling.oem || null,
            coupling_type: body.coupling.couplingType || null,
            size: body.coupling.size || null,
            spacer: body.coupling.spacer || null,
            notes: body.coupling.notes || null
          },
          { onConflict: "asset_id" }
        );

        if (couplingError) {
          throw couplingError;
        }
      } else {
        const { error: couplingDeleteError } = await supabase
          .from("asset_couplings")
          .delete()
          .eq("asset_id", params.id);

        if (couplingDeleteError) {
          throw couplingDeleteError;
        }
      }
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
