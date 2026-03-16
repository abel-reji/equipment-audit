import { NextResponse } from "next/server";

import { requireSessionAccount } from "@/lib/account";
import { addMonthsToDate } from "@/lib/pm";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { pmLogSchema } from "@/lib/validation";

export async function POST(request: Request) {
  try {
    const body = pmLogSchema.parse(await request.json());
    const supabase = createServerSupabaseClient();
    const { account } = await requireSessionAccount(supabase);

    const { data: program, error: programError } = await supabase
      .from("pm_programs")
      .select("*")
      .eq("id", body.programId)
      .single();

    if (programError || !program) {
      throw new Error(programError?.message ?? "PM program not found");
    }

    const completedAt = body.status === "completed" ? body.completedAt ?? body.dueAt : null;
    const baseDate = body.status === "completed" ? completedAt ?? body.dueAt : body.dueAt;
    const nextDueAt = addMonthsToDate(baseDate, program.frequency_months);

    const { data: log, error: logError } = await supabase
      .from("pm_logs")
      .insert({
        account_id: account.id,
        pm_program_id: body.programId,
        asset_id: body.assetId,
        due_at: body.dueAt,
        completed_at: completedAt,
        status: body.status,
        performed_by: body.performedBy || null,
        summary: body.summary || null,
        work_notes: body.workNotes || null,
        findings: body.findings || null,
        follow_up_required: body.followUpRequired,
        checklist_results: body.checklistResults
      })
      .select("*")
      .single();

    if (logError || !log) {
      throw new Error(logError?.message ?? "Unable to log PM work");
    }

    const { error: updateError } = await supabase
      .from("pm_programs")
      .update({
        next_due_at: nextDueAt,
        last_completed_at: body.status === "completed" ? completedAt : program.last_completed_at
      })
      .eq("id", body.programId);

    if (updateError) {
      throw updateError;
    }

    return NextResponse.json({ log, nextDueAt });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to save PM log" },
      { status: 400 }
    );
  }
}
