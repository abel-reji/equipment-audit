import { NextResponse } from "next/server";

import { requireSessionAccount } from "@/lib/account";
import { addMonthsToDate } from "@/lib/pm";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { pmProgramSchema } from "@/lib/validation";

export async function POST(request: Request) {
  try {
    const body = pmProgramSchema.parse(await request.json());
    const supabase = createServerSupabaseClient();
    const { account } = await requireSessionAccount(supabase);

    const { data: existing } = await supabase
      .from("pm_programs")
      .select("id")
      .eq("asset_id", body.assetId)
      .maybeSingle();

    if (existing) {
      throw new Error("A PM program already exists for this asset");
    }

    const { data, error } = await supabase
      .from("pm_programs")
      .insert({
        account_id: account.id,
        asset_id: body.assetId,
        title: body.title,
        frequency_months: body.frequencyMonths,
        start_date: body.startDate,
        next_due_at: addMonthsToDate(body.startDate, body.frequencyMonths),
        instructions: body.instructions || null,
        checklist_template: body.checklistTemplate
      })
      .select("*")
      .single();

    if (error || !data) {
      throw new Error(error?.message ?? "Unable to create PM program");
    }

    return NextResponse.json({ program: data });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to create PM program" },
      { status: 400 }
    );
  }
}
