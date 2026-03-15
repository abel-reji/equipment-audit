import { NextResponse } from "next/server";

import { requireSessionAccount } from "@/lib/account";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { siteSchema } from "@/lib/validation";

export async function GET(request: Request) {
  try {
    const supabase = createServerSupabaseClient();
    await requireSessionAccount(supabase);

    const url = new URL(request.url);
    const recent = url.searchParams.get("recent");

    let query = supabase.from("sites").select("*, customers(name)");

    if (recent === "true") {
      query = query.order("last_used_at", { ascending: false, nullsFirst: false }).limit(8);
    } else {
      query = query.order("updated_at", { ascending: false });
    }

    const { data, error } = await query;

    if (error) {
      throw error;
    }

    return NextResponse.json({ sites: data });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to load sites" },
      { status: 400 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = siteSchema.parse(await request.json());
    const supabase = createServerSupabaseClient();
    const { account } = await requireSessionAccount(supabase);

    const { data, error } = await supabase
      .from("sites")
      .upsert(
        {
          account_id: account.id,
          customer_id: body.customerId,
          client_uid: body.id,
          name: body.name,
          address: body.address || null,
          area_unit: body.areaUnit || null,
          notes: body.notes || null,
          last_used_at: body.lastUsedAt ?? null
        },
        { onConflict: "account_id,client_uid" }
      )
      .select("id")
      .single();

    if (error || !data) {
      throw new Error(error?.message ?? "Unable to save site");
    }

    return NextResponse.json({ siteId: data.id });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to save site" },
      { status: 400 }
    );
  }
}
