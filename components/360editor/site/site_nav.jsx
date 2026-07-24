// components/360editor/site/site_nav.jsx
// Shared top bar for the public pages (landing, /how-it-works, /pricing,
// /privacy, /terms). Server component; the avatar dropdown is the AccountMenu
// client component, which owns its own open state and sign-out request.
//
// LAYOUT: the row has exactly TWO children — the logo, and one group holding
// everything else. justify-between then does the whole job: logo hard left,
// the rest hard right, page links sitting immediately left of the buy CTA.
// (Auto-margins on a third middle child are what made the links cling to the
// logo before.)
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import AccountMenu from '@/components/360editor/site/account_menu'

export default function SiteNav({ user, active }) {
    const email = user?.email || ''

    const link = (href, label) => (
        <Link
            href={href}
            className={`text-[14px] font-medium no-underline transition-colors ${
                active === href ? 'text-[#3730a3]' : 'text-[#1a1a18] hover:text-[#3730a3]'
            }`}
        >
            {label}
        </Link>
    )

    return (
        <nav className="sticky top-0 z-50 bg-white/85 backdrop-blur-lg border-b border-[#E2E2DA]">
            <div className="max-w-5xl mx-auto px-6 h-[60px] flex items-center justify-between gap-5">

                {/* ── LEFT: logo only ── */}
                <Link href="/" className="flex items-center gap-2.5 no-underline group shrink-0">
                    <div className="w-8 h-8 bg-[#3730a3] rounded-lg flex items-center justify-center transition-colors group-hover:bg-[#312e81]">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
                            <circle cx="12" cy="12" r="10"/>
                            <path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
                        </svg>
                    </div>
                    <span className="text-[#1a1a18] font-bold text-[18px] tracking-tight">360<span className="text-[#3730a3]">Editor</span></span>
                </Link>

                {/* ── RIGHT: page links, then the buy CTA, then the account ── */}
                <div className="flex items-center gap-6 shrink-0">

                    <div className="hidden sm:flex items-center gap-6">
                        {link('/how-it-works', 'How it works')}
                        {link('/pricing', 'Pricing')}
                    </div>

                    {user ? (
                        <div className="flex items-center gap-2.5">
                            {/* Buy is always one click away, from any public page */}
                            <Button asChild className="bg-[#3730a3] hover:bg-[#312e81] text-white text-[13.5px] font-semibold h-9 px-4 rounded-lg gap-1.5">
                                <Link href="/pricing">
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 5v14M5 12h14"/></svg>
                                    Buy credits
                                </Link>
                            </Button>

                            <AccountMenu email={email} />
                        </div>
                    ) : (
                        <div className="flex items-center gap-2.5">
                            <Button asChild variant="ghost" className="text-[14px] text-[#1a1a18] hover:bg-[#F4F4EF] h-9">
                                <Link href="/login">Log in</Link>
                            </Button>
                            <Button asChild className="bg-[#3730a3] hover:bg-[#312e81] text-white text-[14px] h-9 px-4 rounded-lg">
                                <Link href="/signup">Sign up free</Link>
                            </Button>
                        </div>
                    )}
                </div>
            </div>

            {/* Small screens: the page links drop to their own row so the buy CTA keeps the top row */}
            <div className="sm:hidden flex items-center gap-5 px-6 h-10 border-t border-[#E2E2DA] bg-white/70">
                {link('/how-it-works', 'How it works')}
                {link('/pricing', 'Pricing')}
            </div>
        </nav>
    )
}