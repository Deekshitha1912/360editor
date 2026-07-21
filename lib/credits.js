import { createAdminClient } from "@/lib/supabase-admin";

// Read a user's credit balance. Returns zeros if they have no row yet.
export async function getCredits(userId) {
  const admin = createAdminClient();
  const { data } = await admin
    .from("credits")
    .select("total_credits, used_credits, available_credits")
    .eq("user_id", userId)
    .maybeSingle();

  return (
    data ?? { total_credits: 0, used_credits: 0, available_credits: 0 }
  );
}

// Consume exactly one credit atomically. Returns true if a credit was
// spent, false if the user has none. Call this BEFORE creating a project.
export async function consumeCredit(userId) {
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("consume_credit", {
    p_user_id: userId,
  });
  if (error) {
    console.error("consume_credit error:", error);
    return false;
  }
  return data === true;
}

// Give a consumed credit back (use if project creation fails after consume).
export async function refundCredit(userId) {
  const admin = createAdminClient();
  const { error } = await admin.rpc("refund_credit", { p_user_id: userId });
  if (error) console.error("refund_credit error:", error);
}
