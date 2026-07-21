import { NextResponse } from "next/server";
import crypto from "crypto";
import { createAdminClient } from "@/lib/supabase-admin";

// Razorpay calls this URL server-to-server after a payment. It is the
// reliable source of truth — even if the user closes the browser before
// the client-side /verify runs, credits still get granted here.
//
// IMPORTANT: read the RAW body for signature verification.
export async function POST(req) {
  const body = await req.text();
  const signature = req.headers.get("x-razorpay-signature");

  const expected = crypto
    .createHmac("sha256", process.env.RAZORPAY_WEBHOOK_SECRET)
    .update(body)
    .digest("hex");

  if (expected !== signature) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  const event = JSON.parse(body);

  if (event.event === "payment.captured" || event.event === "order.paid") {
    const paymentEntity = event.payload?.payment?.entity;
    const orderEntity = event.payload?.order?.entity;

    const orderId = paymentEntity?.order_id || orderEntity?.id;
    const paymentId = paymentEntity?.id ?? null;

    if (orderId) {
      const admin = createAdminClient();

      // Same idempotent status flip as /verify.
      const { data: updated } = await admin
        .from("payments")
        .update({
          status: "paid",
          razorpay_payment_id: paymentId,
          updated_at: new Date().toISOString(),
        })
        .eq("razorpay_order_id", orderId)
        .neq("status", "paid")
        .select();

      if (updated && updated.length > 0) {
        const p = updated[0];
        await admin.rpc("grant_credits", {
          p_user_id: p.user_id,
          p_credits: p.credits_granted,
        });
      }
    }
  }

  return NextResponse.json({ received: true });
}
