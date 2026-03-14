import { NextResponse } from "next/server";

import { requireSessionAccount } from "@/lib/account";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { assetDraftSchema } from "@/lib/validation";

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

    return NextResponse.json({ assetId: data.id, captureStatus: data.capture_status });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to save asset" },
      { status: 400 }
    );
  }
}

