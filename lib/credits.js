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
// reason/referenceId are logged to credit_ledger (db/026) so a spend is
// traceable to what actually caused it — pass the calling route's own name
// ('project_create', 'export_zip', 'renew') and whatever id it concerns
// (the new project's id, the project being exported/renewed).
export async function consumeCredit(userId, reason = null, referenceId = null) {
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("consume_credit", {
    p_user_id: userId,
    p_reason: reason,
    p_reference_id: referenceId,
  });
  if (error) {
    console.error("consume_credit error:", error);
    return false;
  }
  return data === true;
}

// Give a consumed credit back (use if project creation fails after consume).
export async function refundCredit(userId, reason = null, referenceId = null) {
  const admin = createAdminClient();
  const { error } = await admin.rpc("refund_credit", {
    p_user_id: userId,
    p_reason: reason,
    p_reference_id: referenceId,
  });
  if (error) console.error("refund_credit error:", error);
}
