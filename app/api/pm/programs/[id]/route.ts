import { NextResponse } from "next/server";

import { requireSessionAccount } from "@/lib/account";
import { addMonthsToDate } from "@/lib/pm";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { pmProgramPatchSchema } from "@/lib/validation";

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const body = pmProgramPatchSchema.parse(await request.json());
    const supabase = createServerSupabaseClient();
    await requireSessionAccount(supabase);

    const { data: current, error: currentError } = await supabase
      .from("pm_programs")
      .select("*")
      .eq("id", params.id)
      .single();

    if (currentError || !current) {
      throw new Error(currentError?.message ?? "PM program not found");
    }

    const frequencyMonths = body.frequencyMonths ?? current.frequency_months;
    const startDate = body.startDate ?? current.start_date;
    const nextDueAt =
      body.nextDueAt ??
      (current.last_completed_at
        ? addMonthsToDate(current.last_completed_at, frequencyMonths)
        : addMonthsToDate(startDate, frequencyMonths));

    const { data, error } = await supabase
      .from("pm_programs")
      .update({
        title: body.title ?? current.title,
        frequency_months: frequencyMonths,
        start_date: startDate,
        next_due_at: nextDueAt,
        instructions:
          body.instructions !== undefined ? body.instructions || null : current.instructions,
        checklist_template: body.checklistTemplate ?? current.checklist_template,
        is_active: body.isActive ?? current.is_active
      })
      .eq("id", params.id)
      .select("*")
      .single();

    if (error || !data) {
      throw new Error(error?.message ?? "Unable to update PM program");
    }

    return NextResponse.json({ program: data });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to update PM program" },
      { status: 400 }
    );
  }
}
