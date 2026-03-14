import type { SupabaseClient } from "@supabase/supabase-js";

export async function requireSessionAccount(supabase: SupabaseClient) {
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Unauthorized");
  }

  const { data: account, error } = await supabase
    .from("accounts")
    .upsert(
      {
        auth_user_id: user.id,
        display_name: user.email ?? user.user_metadata?.full_name ?? null
      },
      { onConflict: "auth_user_id" }
    )
    .select()
    .single();

  if (error || !account) {
    throw new Error(error?.message ?? "Unable to bootstrap account");
  }

  return { user, account };
}
