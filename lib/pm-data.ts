import { requireSessionAccount } from "@/lib/account";
import { pmRecentCompletedLimit } from "@/lib/constants";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { PmAssetDetail, PmDueItem, PmLogRecord, PmProgramRecord } from "@/lib/types";

function relationToSingle<T>(value: T | T[] | null | undefined) {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return value ?? null;
}

export async function loadPmDueItems() {
  const supabase = createServerSupabaseClient();
  await requireSessionAccount(supabase);

  const { data: programs, error } = await supabase
    .from("pm_programs")
    .select("*, assets(*, sites(*, customers(*))), pm_logs(*)")
    .eq("is_active", true)
    .order("next_due_at", { ascending: true });

  if (error) {
    throw error;
  }

  return ((programs ?? []) as Array<Record<string, unknown>>).map((program) => {
    const asset = program.assets as Record<string, unknown>;
    const site = asset?.sites as Record<string, unknown>;
    const customer = relationToSingle(site?.customers as Record<string, unknown> | Array<Record<string, unknown>> | null);
    const logs = Array.isArray(program.pm_logs) ? (program.pm_logs as PmLogRecord[]) : [];
    const lastLog = [...logs].sort((a, b) => (a.due_at < b.due_at ? 1 : -1))[0] ?? null;

    return {
      program: {
        ...(program as unknown as PmProgramRecord),
        checklist_template: Array.isArray(program.checklist_template)
          ? (program.checklist_template as string[])
          : []
      },
      asset: asset as unknown as PmDueItem["asset"],
      site: site as unknown as PmDueItem["site"],
      customer: (customer as PmDueItem["customer"]) ?? null,
      lastLog
    } satisfies PmDueItem;
  });
}

export async function loadPmAssetDetail(assetId: string): Promise<PmAssetDetail> {
  const supabase = createServerSupabaseClient();
  await requireSessionAccount(supabase);

  const { data: asset, error: assetError } = await supabase
    .from("assets")
    .select("*, sites(*, customers(*))")
    .eq("id", assetId)
    .single();

  if (assetError || !asset) {
    throw new Error(assetError?.message ?? "Asset not found");
  }

  const { data: program, error: programError } = await supabase
    .from("pm_programs")
    .select("*")
    .eq("asset_id", assetId)
    .maybeSingle();

  if (programError) {
    throw programError;
  }

  const { data: logs, error: logsError } = await supabase
    .from("pm_logs")
    .select("*")
    .eq("asset_id", assetId)
    .order("due_at", { ascending: false })
    .limit(50);

  if (logsError) {
    throw logsError;
  }

  return {
    asset,
    site: asset.sites,
    customer: relationToSingle(asset.sites?.customers) as PmAssetDetail["customer"],
    program: program
      ? {
          ...(program as PmProgramRecord),
          checklist_template: Array.isArray(program.checklist_template)
            ? (program.checklist_template as string[])
            : []
        }
      : null,
    logs: (logs ?? []).map((log) => ({
      ...(log as PmLogRecord),
      checklist_results: Array.isArray(log.checklist_results)
        ? (log.checklist_results as PmLogRecord["checklist_results"])
        : []
    }))
  };
}

export async function loadRecentPmLogs() {
  const supabase = createServerSupabaseClient();
  await requireSessionAccount(supabase);

  const { data, error } = await supabase
    .from("pm_logs")
    .select("*, assets(equipment_tag, equipment_type)")
    .order("created_at", { ascending: false })
    .limit(pmRecentCompletedLimit);

  if (error) {
    throw error;
  }

  return (data ?? []).map((log) => ({
    ...(log as PmLogRecord),
    checklist_results: Array.isArray(log.checklist_results)
      ? (log.checklist_results as PmLogRecord["checklist_results"])
      : []
  }));
}
