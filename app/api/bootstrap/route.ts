import { NextResponse } from "next/server";

import { requireSessionAccount } from "@/lib/account";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function GET() {
  try {
    const supabase = createServerSupabaseClient();
    const { account } = await requireSessionAccount(supabase);

    const [{ data: customers, error: customersError }, { data: sites, error: sitesError }] =
      await Promise.all([
        supabase
          .from("customers")
          .select("*")
          .order("name", { ascending: true }),
        supabase
          .from("sites")
          .select("*")
          .order("updated_at", { ascending: false })
      ]);

    if (customersError || sitesError) {
      throw new Error(customersError?.message ?? sitesError?.message ?? "Bootstrap failed");
    }

    return NextResponse.json({
      account,
      customers,
      sites
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unauthorized" },
      { status: 401 }
    );
  }
}

