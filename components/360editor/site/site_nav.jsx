// components/360editor/site/site_nav.jsx
// Shared top bar for the public pages (landing, /how-it-works, /pricing).
// Server component — the avatar dropdown is a <details>, and sign-out is wired
// up by the small script in site_shell.jsx.
//
// LAYOUT: the row has exactly TWO children — the logo, and one group holding
// everything else. justify-between then does the whole job: logo hard left,
// the rest hard right, page links sitting immediately left of the buy CTA.
// (Auto-margins on a third middle child are what made the links cling to the
// logo before.)
import Link from 'next/link'
import { Button } from '@/components/ui/button'

export default function SiteNav({ user, active }) {
    const email    = user?.email || ''
    const initials = (email[0] || '?').toUpperCase()

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

                            <details className="avatar-menu relative">
                                <summary className="list-none cursor-pointer w-9 h-9 rounded-full bg-[#3730a3] text-white text-sm font-bold flex items-center justify-center hover:bg-[#312e81] transition-colors select-none">
                                    {initials}
                                </summary>
                                <div className="absolute right-0 mt-2 w-56 bg-white border border-[#E2E2DA] rounded-xl shadow-xl overflow-hidden z-50">
                                    <div className="px-3.5 py-3 border-b border-[#E2E2DA]">
                                        <p className="text-[13px] font-semibold text-[#1a1a18] truncate">My Account</p>
                                        <p className="text-[11.5px] text-[#6b6b60] truncate">{email}</p>
                                    </div>
                                    <Link href="/360editor" className="flex items-center gap-2.5 px-3.5 py-2.5 text-[13px] text-[#1a1a18] hover:bg-[#F4F4EF] no-underline">
                                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg>
                                        Your projects
                                    </Link>
                                    <button id="landing-signout" type="button" className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-[13px] text-red-600 hover:bg-red-50 bg-transparent border-none cursor-pointer text-left">
                                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/></svg>
                                        Sign out
                                    </button>
                                </div>
                            </details>
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