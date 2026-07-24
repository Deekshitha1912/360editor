// app/pricing/page.jsx — the real pricing page (replaces /#pricing)
import Link from 'next/link'
import { createClient } from '@/lib/supabase-server'
import { getCredits } from '@/lib/credits'
import SiteShell from '@/components/360editor/site/site_shell'
import Pricing_section from '@/components/360editor/project/payment/pricing_section'

export const metadata = {
    title: 'Pricing — 360Editor',
    description: 'Pay per tour, no subscription. 1 credit = 1 virtual tour.',
}

const FAQ = [
    ['What exactly is a credit?',
        'One credit creates one tour. The tour itself has no limit on how many times you edit, publish, or re-export it — the credit is spent once, when you create the project.'],
    ['Do credits expire?',
        'No. Buy three now, use the third one next year if that suits you.'],
    ['Is there a monthly fee?',
        'None. You pay for the tours you make and nothing else.'],
    ['What happens if a payment fails?',
        'The credit is only granted after the payment is verified on our side. If money left your account but no credit appeared, it is credited shortly — or write to us and we will sort it out.'],
]

export default async function PricingPage({ searchParams }) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    const sp = await searchParams
    const showNoCredits = sp?.nocredits === '1'

    const credits = user ? await getCredits(user.id) : null
    const available = credits?.available_credits ?? 0

    return (
        <SiteShell user={user ? { email: user.email } : null} active="/pricing">

            {/* ── Header ── */}
            <section className="relative grain overflow-hidden bg-[#0d0c14]">
                <div className="pointer-events-none absolute -top-40 -left-32 w-[520px] h-[520px] rounded-full blur-[120px]" style={{ background:'radial-gradient(circle,rgba(55,48,163,.55),transparent 70%)' }} />
                <div className="relative max-w-5xl mx-auto px-6 py-16 text-center">
                    <h1 className="serif text-white text-[clamp(30px,4.4vw,46px)] font-semibold tracking-[-1.2px] leading-[1.08] mb-4 fade-up">
                        Pay per tour. No subscription.
                    </h1>
                    <p className="text-[16px] text-[#b9b9cc] max-w-[440px] mx-auto fade-up" style={{ animationDelay:'.06s' }}>
                        One credit builds one virtual tour, yours to edit and re-publish forever.
                        Buy what you need, when you need it.
                    </p>

                    {user && (
                        <CreditBalance
                            available={available}
                            used={credits?.used_credits ?? 0}
                            total={credits?.total_credits ?? 0}
                        />
                    )}
                </div>
            </section>

            {/* ── Plans ── */}
            <Pricing_section
                bare
                isAuthenticated={!!user}
                user={user ? { email: user.email } : null}
                showNoCredits={showNoCredits}
            />

            {/* ── Reassurance strip ── */}
            <section className="max-w-5xl mx-auto px-6 pb-4">
                <div className="grid sm:grid-cols-3 gap-4">
                    {[
                        ['Secure checkout', 'Payments run through Razorpay. Cards, UPI and net banking all work.'],
                        ['Credits never expire', 'Unused credits sit on your account until you want them.'],
                        ['Tours stay yours', 'Publish to a link, or download the standalone file and host it yourself.'],
                    ].map(([t, b]) => (
                        <div key={t} className="bg-white border border-[#E2E2DA] rounded-2xl p-5" data-reveal>
                            <h3 className="text-[14px] font-semibold text-[#1a1a18] mb-1.5">{t}</h3>
                            <p className="text-[13px] text-[#6b6b60] leading-relaxed">{b}</p>
                        </div>
                    ))}
                </div>
            </section>

            {/* ── FAQ ── */}
            <section className="max-w-3xl mx-auto px-6 py-16">
                <h2 className="serif text-[26px] font-semibold text-[#1a1a18] tracking-[-0.5px] mb-8 text-center" data-reveal>
                    Questions people ask before buying
                </h2>
                <div className="space-y-3">
                    {FAQ.map(([q, a]) => (
                        <details key={q} className="group bg-white border border-[#E2E2DA] rounded-xl px-5 py-4" data-reveal>
                            <summary className="cursor-pointer list-none flex items-center justify-between gap-4 text-[14.5px] font-semibold text-[#1a1a18]">
                                {q}
                                <svg className="shrink-0 transition-transform group-open:rotate-45" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#3730a3" strokeWidth="2.5"><path d="M12 5v14M5 12h14"/></svg>
                            </summary>
                            <p className="mt-3 text-[13.5px] text-[#6b6b60] leading-relaxed">{a}</p>
                        </details>
                    ))}
                </div>
            </section>

            {/* ── Closing CTA ── */}
            <section className="max-w-5xl mx-auto px-6 pb-20">
                <div className="relative rounded-3xl overflow-hidden bg-[#3730a3] text-center px-6 py-12 glow-indigo grain" data-reveal>
                    <div className="pointer-events-none absolute -top-24 -right-16 w-72 h-72 rounded-full blur-[90px]" style={{ background:'radial-gradient(circle,rgba(163,230,53,.28),transparent 70%)' }} />
                    <h2 className="serif relative text-white text-[clamp(22px,3.2vw,32px)] font-semibold tracking-[-0.6px] mb-3">
                        Not sure yet? Look at what you&apos;d be building.
                    </h2>
                    <Link href="/how-it-works" className="relative inline-flex items-center justify-center h-11 px-7 rounded-xl bg-white text-[#3730a3] text-[14.5px] font-bold no-underline hover:bg-[#f4f4ef] transition-colors">
                        See how it works →
                    </Link>
                </div>
            </section>
        </SiteShell>
    )
}

// ─────────────────────────────────────────────────────────────────────────────
// Credit balance panel — only rendered for logged-in users.
//
// Three states, because "You have 0 credits left" is a dead end and the whole
// point of this page is the next click:
//   empty → send them down to the plans
//   low   → they can still work, but flag it
//   ok    → get out of the way, link straight back to the editor
// ─────────────────────────────────────────────────────────────────────────────
function CreditBalance({ available, used, total }) {
    const neverBought = total === 0
    const state = available === 0 ? 'empty' : available <= 2 ? 'low' : 'ok'

    const TONE = {
        empty: { panel: 'border-red-400/25 bg-red-500/10',   num: 'text-red-200',   dot: '#f87171' },
        low:   { panel: 'border-amber-300/25 bg-amber-400/10', num: 'text-amber-100', dot: '#fbbf24' },
        ok:    { panel: 'border-white/15 bg-white/10',        num: 'text-white',     dot: '#a3e635' },
    }[state]

    const headline = {
        empty: neverBought ? 'No credits yet' : 'You\u2019re out of credits',
        low:   `${available} credit${available === 1 ? '' : 's'} left`,
        ok:    `${available} credits ready to use`,
    }[state]

    const sub = {
        empty: 'Pick a plan below and your next tour is one click away.',
        low:   `Enough for ${available === 1 ? 'one more tour' : `${available} more tours`}. Top up whenever suits you.`,
        ok:    `That\u2019s ${available} more tour${available === 1 ? '' : 's'} you can build.`,
    }[state]

    return (
        <div
            className={`mt-8 mx-auto max-w-[480px] flex items-center gap-4 rounded-2xl border px-5 py-4 text-left backdrop-blur fade-up ${TONE.panel}`}
            style={{ animationDelay: '.12s' }}
        >
            {/* Balance */}
            <div className="shrink-0 text-center min-w-[52px]">
                <div className={`serif text-[34px] font-semibold leading-none ${TONE.num}`}>{available}</div>
                <div className="mt-1 text-[10px] font-semibold tracking-widest text-white/40 uppercase">
                    {available === 1 ? 'credit' : 'credits'}
                </div>
            </div>

            <div className="w-px self-stretch bg-white/12" />

            {/* Copy */}
            <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: TONE.dot }} />
                    <p className="text-[14px] font-semibold text-white truncate">{headline}</p>
                </div>
                <p className="mt-1 text-[12.5px] text-white/55 leading-snug">{sub}</p>
                {!neverBought && (
                    <p className="mt-1.5 text-[11px] text-white/35">{used} of {total} used so far</p>
                )}
            </div>

            {/* Action */}
            {available > 0 ? (
                <Link
                    href="/360editor"
                    className="shrink-0 inline-flex items-center gap-1.5 h-9 px-4 rounded-lg bg-white text-[#1a1a18] text-[13px] font-semibold no-underline hover:bg-[#f4f4ef] transition-colors"
                >
                    Dashboard
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M5 12h14M13 6l6 6-6 6"/></svg>
                </Link>
            ) : (
                <a
                    href="#pricing"
                    className="shrink-0 inline-flex items-center gap-1.5 h-9 px-4 rounded-lg bg-white text-[#3730a3] text-[13px] font-bold no-underline hover:bg-[#f4f4ef] transition-colors"
                >
                    See plans
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 5v14M19 12l-7 7-7-7"/></svg>
                </a>
            )}
        </div>
    )
}