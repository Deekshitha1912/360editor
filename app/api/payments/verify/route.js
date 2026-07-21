import { NextResponse } from "next/server";
import crypto from "crypto";
import { createClient } from "@/lib/supabase-server";
import { createAdminClient } from "@/lib/supabase-admin";

export async function POST(req) {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } =
      await req.json();

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 1. Verify the signature: HMAC-SHA256(order_id|payment_id, key_secret).
    const expected = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest("hex");

    if (expected !== razorpay_signature) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
    }

    const admin = createAdminClient();

    // 2. Load the pending payment and confirm it belongs to this user.
    const { data: payment } = await admin
      .from("payments")
      .select("*")
      .eq("razorpay_order_id", razorpay_order_id)
      .eq("user_id", user.id)
      .maybeSingle();

    if (!payment) {
      return NextResponse.json({ error: "Payment not found" }, { status: 404 });
    }

    // 3. Flip status created -> paid. The .neq("status","paid") guard makes
    //    this idempotent: if the webhook already processed it, 0 rows update
    //    and we skip granting credits a second time.
    const { data: updated } = await admin
      .from("payments")
      .update({
        status: "paid",
        razorpay_payment_id,
        razorpay_signature,
        updated_at: new Date().toISOString(),
      })
      .eq("razorpay_order_id", razorpay_order_id)
      .neq("status", "paid")
      .select();

    if (!updated || updated.length === 0) {
      return NextResponse.json({ success: true, alreadyProcessed: true });
    }

    // 4. Grant the credits.
    await admin.rpc("grant_credits", {
      p_user_id: payment.user_id,
      p_credits: payment.credits_granted,
    });

    return NextResponse.json({ success: true, credits: payment.credits_granted });
  } catch (err) {
    console.error("verify error:", err);
    return NextResponse.json(
      { error: "Verification failed" },
      { status: 500 }
    );
  }
}
