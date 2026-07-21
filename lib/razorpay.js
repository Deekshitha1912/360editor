import Razorpay from "razorpay";

// Server-side Razorpay client. Never expose key_secret to the browser.
export const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

// Single source of truth for pricing. Amounts are in PAISE.
// The client never sends the amount — it only sends the plan key, and
// the server looks up the real amount here. This prevents a user from
// tampering with the price in the browser.
export const PLANS = {
  single: {
    key: "single",
    amount: 50000, // ₹500
    credits: 1,
    title: "Single Project",
    priceLabel: "₹500",
  },
  triple: {
    key: "triple",
    amount: 100000, // ₹1000
    credits: 3,
    title: "3 Projects",
    priceLabel: "₹1000",
  },
};
