"use client";

import { useState } from "react";
import Script from "next/script";

/**
 * Drop-in buy button. Usage:
 *   <Buy_credits_button plan="single" user={user} className="...">Buy 1 credit</Buy_credits_button>
 *   <Buy_credits_button plan="triple" user={user} className="...">Buy 3 credits</Buy_credits_button>
 *
 * `user` is optional and only used to prefill name/email in checkout.
 */
export default function Buy_credits_button({
  plan,
  user,
  className = "",
  onSuccess,
  children,
}) {
  const [loading, setLoading] = useState(false);

  async function handleBuy() {
    try {
      setLoading(true);

      // 1. Ask the server to create the order.
      const res = await fetch("/api/payments/create-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan }),
      });
      const order = await res.json();
      if (!res.ok) throw new Error(order.error || "Could not start payment");

      // 2. Open Razorpay Checkout.
      const rzp = new window.Razorpay({
        key: order.keyId,
        amount: order.amount,
        currency: order.currency,
        name: "360Editor",
        description:
          plan === "single" ? "1 Project Credit" : "3 Project Credits",
        order_id: order.orderId,
        theme: { color: "#4f46e5" },
        prefill: {
          name: user?.user_metadata?.full_name || "",
          email: user?.email || "",
        },
        handler: async function (response) {
          // 3. Verify on the server; credits are granted there.
          const verifyRes = await fetch("/api/payments/verify", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(response),
          });
          const result = await verifyRes.json();
          if (result.success) {
            if (onSuccess) onSuccess(result);
            else window.location.reload(); // refresh credits shown on the page
          } else {
            alert(
              "Payment could not be verified. If money was deducted it will be credited shortly."
            );
          }
        },
        modal: {
          ondismiss: () => setLoading(false),
        },
      });
      rzp.open();
    } catch (err) {
      alert(err.message);
      setLoading(false);
    }
  }

  return (
    <>
      <Script
        src="https://checkout.razorpay.com/v1/checkout.js"
        strategy="lazyOnload"
      />
      <button onClick={handleBuy} disabled={loading} className={className}>
        {loading ? "Processing…" : children}
      </button>
    </>
  );
}
