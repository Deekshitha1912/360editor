import { NextResponse } from "next/server";
import { razorpay, PLANS } from "@/lib/razorpay";
import { createClient } from "@/lib/supabase-server";
import { createAdminClient } from "@/lib/supabase-admin";

export async function POST(req) {
  try {
    const { plan } = await req.json();
    const selected = PLANS[plan];
    if (!selected) {
      return NextResponse.json({ error: "Invalid plan" }, { status: 400 });
    }

    // Identify the buyer from the session.
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Create the order with Razorpay.
    const order = await razorpay.orders.create({
      amount: selected.amount,
      currency: "INR",
      receipt: `rcpt_${user.id.slice(0, 8)}_${Date.now()}`,
      notes: {
        user_id: user.id,
        plan,
        credits: String(selected.credits),
      },
    });

    // Record a pending payment (service role bypasses RLS).
    const admin = createAdminClient();
    const { error: insertError } = await admin.from("payments").insert({
      user_id: user.id,
      razorpay_order_id: order.id,
      plan,
      amount: selected.amount,
      credits_granted: selected.credits,
      status: "created",
    });
    if (insertError) {
      console.error("payment insert error:", insertError);
      return NextResponse.json(
        { error: "Could not record order" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      keyId: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
      credits: selected.credits,
    });
  } catch (err) {
    console.error("create-order error:", err);
    return NextResponse.json(
      { error: "Failed to create order" },
      { status: 500 }
    );
  }
}
