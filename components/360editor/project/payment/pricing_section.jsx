"use client";

import Link from "next/link";
import { Check } from "lucide-react";
import BuyCreditsButton from "@/components/Buy_credits_button";

const PLANS = [
  {
    key: "single",
    title: "Single Project",
    price: "₹500",
    credits: 1,
    features: ["1 project credit", "1 virtual tour", "Unlimited hotspots", "Custom logo watermark"],
    highlight: false,
  },
  {
    key: "triple",
    title: "3 Projects",
    price: "₹1000",
    credits: 3,
    priceNote: "Save ₹500",
    features: ["3 project credits", "3 virtual tours", "Unlimited hotspots", "Custom logo watermark", "Best value"],
    highlight: true,
  },
];

/**
 * mode="landing" -> CTA links to /signup (no session yet)
 * mode="app"     -> CTA is a live Razorpay buy button
 */
export default function Pricing_section({ mode = "landing", user }) {
  return (
    <section id="pricing" className="mx-auto max-w-4xl px-4 py-16">
      <div className="mb-10 text-center">
        <h2 className="text-3xl font-bold tracking-tight text-gray-900">
          Simple, credit-based pricing
        </h2>
        <p className="mt-3 text-gray-600">
          Pay per project. 1 credit = 1 virtual tour. No subscriptions.
        </p>
      </div>

      <div className="grid gap-6 sm:grid-cols-2">
        {PLANS.map((plan) => (
          <div
            key={plan.key}
            className={`relative rounded-2xl border p-8 ${
              plan.highlight
                ? "border-indigo-600 shadow-lg ring-1 ring-indigo-600"
                : "border-gray-200"
            }`}
          >
            {plan.highlight && (
              <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-indigo-600 px-3 py-1 text-xs font-semibold text-white">
                Most popular
              </span>
            )}

            <h3 className="text-lg font-semibold text-gray-900">{plan.title}</h3>
            <div className="mt-4 flex items-baseline gap-2">
              <span className="text-4xl font-bold text-gray-900">{plan.price}</span>
              {plan.priceNote && (
                <span className="text-sm font-medium text-green-600">
                  {plan.priceNote}
                </span>
              )}
            </div>
            <p className="mt-1 text-sm text-gray-500">
              {plan.credits} credit{plan.credits > 1 ? "s" : ""}
            </p>

            <ul className="mt-6 space-y-3">
              {plan.features.map((f) => (
                <li key={f} className="flex items-center gap-2 text-sm text-gray-700">
                  <Check className="h-4 w-4 text-indigo-600" />
                  {f}
                </li>
              ))}
            </ul>

            <div className="mt-8">
              {mode === "app" ? (
                <BuyCreditsButton
                  plan={plan.key}
                  user={user}
                  className={`w-full rounded-lg px-4 py-2.5 text-sm font-semibold transition ${
                    plan.highlight
                      ? "bg-indigo-600 text-white hover:bg-indigo-700"
                      : "bg-gray-900 text-white hover:bg-gray-800"
                  }`}
                >
                  Buy {plan.credits} credit{plan.credits > 1 ? "s" : ""}
                </BuyCreditsButton>
              ) : (
                <Link
                  href="/signup"
                  className={`block w-full rounded-lg px-4 py-2.5 text-center text-sm font-semibold transition ${
                    plan.highlight
                      ? "bg-indigo-600 text-white hover:bg-indigo-700"
                      : "bg-gray-900 text-white hover:bg-gray-800"
                  }`}
                >
                  Get started
                </Link>
              )}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
