import { NextResponse } from "next/server";

import { requireSessionAccount } from "@/lib/account";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  try {
    const supabase = createServerSupabaseClient();
    await requireSessionAccount(supabase);

    const query = new URL(request.url).searchParams.get("q")?.trim() ?? "";

    if (!query) {
      return NextResponse.json({ customers: [], sites: [] });
    }

    const [{ data: customers, error: customerError }, { data: sites, error: siteError }] =
      await Promise.all([
        supabase
          .from("customers")
          .select("*")
          .ilike("name", `%${query}%`)
          .order("name", { ascending: true })
          .limit(10),
        supabase
          .from("sites")
          .select("*, customers(name)")
          .ilike("name", `%${query}%`)
          .order("name", { ascending: true })
          .limit(10)
      ]);

    if (customerError || siteError) {
      throw new Error(customerError?.message ?? siteError?.message ?? "Search failed");
    }

    return NextResponse.json({
      customers,
      sites: (sites ?? []).map((site) => ({
        ...site,
        customer_name: Array.isArray(site.customers) ? site.customers[0]?.name : site.customers?.name
      }))
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Search failed" },
      { status: 400 }
    );
  }
}

