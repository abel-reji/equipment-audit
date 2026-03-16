import { NextResponse } from "next/server";

import { requireSessionAccount } from "@/lib/account";
import { addMonthsToDate } from "@/lib/pm";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { pmProgramBatchSchema, pmProgramSchema } from "@/lib/validation";

export async function POST(request: Request) {
  try {
    const rawBody = await request.json();
    const supabase = createServerSupabaseClient();
    const { account } = await requireSessionAccount(supabase);

    if (Array.isArray(rawBody?.assetIds)) {
      const body = pmProgramBatchSchema.parse(rawBody);
      const { data: existingPrograms, error: existingError } = await supabase
        .from("pm_programs")
        .select("asset_id")
        .in("asset_id", body.assetIds);

      if (existingError) {
        throw existingError;
      }

      const enrolledAssetIds = new Set((existingPrograms ?? []).map((program) => program.asset_id));
      const assetIdsToInsert = body.assetIds.filter((assetId) => !enrolledAssetIds.has(assetId));

      if (!assetIdsToInsert.length) {
        throw new Error("All selected assets already have PM programs");
      }

      const nextDueAt = addMonthsToDate(body.startDate, body.frequencyMonths);
      const insertPayload = assetIdsToInsert.map((assetId) => ({
        account_id: account.id,
        asset_id: assetId,
        title: body.title,
        frequency_months: body.frequencyMonths,
        start_date: body.startDate,
        next_due_at: nextDueAt,
        instructions: body.instructions || null,
        checklist_template: body.checklistTemplate
      }));

      const { data, error } = await supabase.from("pm_programs").insert(insertPayload).select("*");

      if (error || !data) {
        throw new Error(error?.message ?? "Unable to create PM programs");
      }

      return NextResponse.json({
        programs: data,
        enrolledAssetIds: assetIdsToInsert,
        skippedAssetIds: body.assetIds.filter((assetId) => enrolledAssetIds.has(assetId))
      });
    }

    const body = pmProgramSchema.parse(rawBody);

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
