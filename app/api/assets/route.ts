import { NextResponse } from "next/server";

import { requireSessionAccount } from "@/lib/account";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { assetDraftSchema } from "@/lib/validation";

function hasValues(record?: Record<string, string | undefined>) {
  return Boolean(record && Object.values(record).some((value) => value && value.trim().length > 0));
}

export async function GET(request: Request) {
  try {
    const supabase = createServerSupabaseClient();
    await requireSessionAccount(supabase);
    const url = new URL(request.url);
    const siteId = url.searchParams.get("siteId");

    let query = supabase
      .from("assets")
      .select("*, sites(name)")
      .order("updated_at", { ascending: false })
      .limit(10);

    if (siteId) {
      query = query.eq("site_id", siteId);
    }

    const { data, error } = await query;
    if (error) {
      throw error;
    }

    return NextResponse.json({ assets: data });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to load assets" },
      { status: 400 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = assetDraftSchema.parse(await request.json());
    const supabase = createServerSupabaseClient();
    const { account } = await requireSessionAccount(supabase);

    const captureStatus = body.photoCount > 0 ? "partial" : "synced";
    const { data, error } = await supabase
      .from("assets")
      .upsert(
        {
          account_id: account.id,
          site_id: body.siteId,
          client_uid: body.id,
          temporary_identifier: body.temporaryIdentifier || null,
          equipment_tag: body.equipmentTag || null,
          equipment_type: body.equipmentType,
          manufacturer: body.manufacturer || null,
          model: body.model || null,
          serial: body.serial || null,
          service_application: body.serviceApplication || null,
          status: body.status || "unknown",
          quick_note: body.quickNote || null,
          capture_status: captureStatus,
          captured_at: new Date().toISOString()
        },
        { onConflict: "account_id,client_uid" }
      )
      .select("id, capture_status")
      .single();

    if (error || !data) {
      throw new Error(error?.message ?? "Unable to save asset");
    }

    if (body.driver !== undefined) {
      if (hasValues(body.driver)) {
        const { error: driverError } = await supabase.from("asset_drivers").upsert(
          {
            account_id: account.id,
            asset_id: data.id,
            motor_oem: body.driver?.motorOem || null,
            motor_model: body.driver?.motorModel || null,
            hp: body.driver?.hp || null,
            rpm: body.driver?.rpm || null,
            voltage: body.driver?.voltage || null,
            frame: body.driver?.frame || null
          },
          { onConflict: "asset_id" }
        );

        if (driverError) {
          throw new Error(driverError.message);
        }
      } else {
        const { error: driverDeleteError } = await supabase
          .from("asset_drivers")
          .delete()
          .eq("asset_id", data.id);

        if (driverDeleteError) {
          throw new Error(driverDeleteError.message);
        }
      }
    }

    if (body.coupling !== undefined) {
      if (hasValues(body.coupling)) {
        const { error: couplingError } = await supabase.from("asset_couplings").upsert(
          {
            account_id: account.id,
            asset_id: data.id,
            oem: body.coupling?.oem || null,
            coupling_type: body.coupling?.couplingType || null,
            size: body.coupling?.size || null,
            spacer: body.coupling?.spacer || null,
            notes: body.coupling?.notes || null
          },
          { onConflict: "asset_id" }
        );

        if (couplingError) {
          throw new Error(couplingError.message);
        }
      } else {
        const { error: couplingDeleteError } = await supabase
          .from("asset_couplings")
          .delete()
          .eq("asset_id", data.id);

        if (couplingDeleteError) {
          throw new Error(couplingDeleteError.message);
        }
      }
    }

    return NextResponse.json({ assetId: data.id, captureStatus: data.capture_status });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to save asset" },
      { status: 400 }
    );
  }
}
