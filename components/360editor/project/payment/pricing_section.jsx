"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check } from "lucide-react";
import Buy_credits_button from "@/components/360editor/project/payment/buy_credits_button";

const PLANS = [
  {
    key: "single",
    title: "Single Project",
    price: "₹500",
    credits: 1,
    features: ["1 project credit", "1 full virtual tour", "Up to 30 rooms", "Custom logo watermark", "One-click HTML export"],
    highlight: false,
  },
  {
    key: "triple",
    title: "3 Projects",
    price: "₹1000",
    credits: 3,
    priceNote: "Save ₹500",
    features: ["3 project credits", "3 full virtual tours", "Up to 30 rooms each", "Custom logo watermark", "One-click HTML export"],
    highlight: true,
  },
];

/**
 * Pricing block for the landing page.
 *   isAuthenticated=false -> CTA links to /signup
 *   isAuthenticated=true  -> live Razorpay buy button; on success -> /360editor
 */
export default function Pricing_section({ isAuthenticated = false, user, showNoCredits = false }) {
  const router = useRouter();

  return (
      <section id="pricing" className="bg-[#FAFAF7] border-t border-[#E2E2DA]">
        <div className="max-w-5xl mx-auto px-6 py-20">
          <h2
              className="serif text-[clamp(24px,3.4vw,34px)] font-semibold text-[#1a1a18] tracking-[-0.5px] mb-2 text-center"
              data-reveal
          >
            Pay per tour. No subscription.
          </h2>
          <p className="text-[15px] text-[#6b6b60] text-center max-w-[460px] mx-auto mb-4" data-reveal>
            1 credit = 1 virtual tour. Buy what you need, whenever you need it.
          </p>

          {showNoCredits && (
              <p className="text-[13.5px] text-center text-[#3730a3] bg-[#eeecfb] border border-[#d9d5f5] rounded-lg px-4 py-2.5 max-w-[440px] mx-auto mb-8 font-medium">
                You need at least one credit to open the editor. Grab a plan below to get started.
              </p>
          )}

          <div className="grid sm:grid-cols-2 gap-6 max-w-3xl mx-auto mt-10">
            {PLANS.map((plan) => (
                <div
                    key={plan.key}
                    data-reveal
                    className={`relative rounded-2xl border p-8 bg-white ${
                        plan.highlight
                            ? "border-[#3730a3] shadow-[0_20px_60px_-24px_rgba(55,48,163,.45)]"
                            : "border-[#E2E2DA]"
                    }`}
                >
                  {plan.highlight && (
                      <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-[#3730a3] px-3 py-1 text-[11px] font-bold tracking-wide text-white">
                  BEST VALUE
                </span>
                  )}

                  <h3 className="text-[15px] font-semibold text-[#1a1a18]">{plan.title}</h3>
                  <div className="mt-3 flex items-baseline gap-2">
                <span className="serif text-[40px] font-semibold text-[#1a1a18] leading-none">
                  {plan.price}
                </span>
                    {plan.priceNote && (
                        <span className="text-[12.5px] font-semibold text-[#3d8f4e]">{plan.priceNote}</span>
                    )}
                  </div>
                  <p className="mt-1.5 text-[12.5px] text-[#6b6b60]">
                    {plan.credits} credit{plan.credits > 1 ? "s" : ""}
                  </p>

                  <ul className="mt-6 space-y-3">
                    {plan.features.map((f) => (
                        <li key={f} className="flex items-center gap-2.5 text-[13.5px] text-[#3a3a34]">
                    <span className="flex-none w-4 h-4 rounded-full bg-[#eeecfb] flex items-center justify-center">
                      <Check className="w-2.5 h-2.5 text-[#3730a3]" strokeWidth={3} />
                    </span>
                          {f}
                        </li>
                    ))}
                  </ul>

                  <div className="mt-8">
                    {isAuthenticated ? (
                        <Buy_credits_button
                            plan={plan.key}
                            user={user}
                            onSuccess={() => router.push("/360editor")}
                            className={`w-full rounded-xl h-11 text-[14px] font-semibold transition ${
                                plan.highlight
                                    ? "bg-[#3730a3] text-white hover:bg-[#312e81]"
                                    : "bg-[#1a1a18] text-white hover:bg-black"
                            }`}
                        >
                          Buy {plan.credits} credit{plan.credits > 1 ? "s" : ""}
                        </Buy_credits_button>
                    ) : (
                        <Link
                            href="/signup"
                            className={`flex items-center justify-center w-full rounded-xl h-11 text-[14px] font-semibold transition ${
                                plan.highlight
                                    ? "bg-[#3730a3] text-white hover:bg-[#312e81]"
                                    : "bg-[#1a1a18] text-white hover:bg-black"
                            }`}
                        >
                          Get started
                        </Link>
                    )}
                  </div>
                </div>
            ))}
          </div>
        </div>
      </section>
  );
}