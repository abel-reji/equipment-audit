import { NextResponse } from "next/server";

import { requireSessionAccount } from "@/lib/account";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { customerSchema } from "@/lib/validation";

export async function GET() {
  try {
    const supabase = createServerSupabaseClient();
    await requireSessionAccount(supabase);

    const { data, error } = await supabase
      .from("customers")
      .select("*")
      .order("name", { ascending: true });

    if (error) {
      throw error;
    }

    return NextResponse.json({ customers: data });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to load customers" },
      { status: 400 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = customerSchema.parse(await request.json());
    const supabase = createServerSupabaseClient();
    const { account } = await requireSessionAccount(supabase);

    const { data, error } = await supabase
      .from("customers")
      .upsert(
        {
          account_id: account.id,
          client_uid: body.id,
          name: body.name,
          notes: body.notes || null
        },
        { onConflict: "account_id,client_uid" }
      )
      .select("id")
      .single();

    if (error || !data) {
      throw new Error(error?.message ?? "Unable to save customer");
    }

    return NextResponse.json({ customerId: data.id });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to save customer" },
      { status: 400 }
    );
  }
}

