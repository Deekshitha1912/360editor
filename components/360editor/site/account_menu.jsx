'use client'
// components/360editor/site/account_menu.jsx
//
// The avatar dropdown. Previously a <details> element whose outside-click
// handler and sign-out listener were attached by a one-shot inline script — so
// after any soft navigation the menu stopped closing and Sign out stopped
// working entirely, with no error to show for it.
//
// React state instead: correct on every navigation, keyboard accessible, and
// the sign-out request lives next to the button that fires it.
import { useEffect, useRef, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'

export default function AccountMenu({ email }) {
    const [open, setOpen] = useState(false)
    const [signingOut, setSigningOut] = useState(false)
    const ref = useRouterSafeRef()
    const router = useRouter()
    const pathname = usePathname()

    const initials = (email?.[0] || '?').toUpperCase()

    // Close on outside click and on Escape
    useEffect(() => {
        if (!open) return
        const onClick = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
        const onKey   = e => { if (e.key === 'Escape') setOpen(false) }
        document.addEventListener('mousedown', onClick)
        document.addEventListener('keydown', onKey)
        return () => {
            document.removeEventListener('mousedown', onClick)
            document.removeEventListener('keydown', onKey)
        }
    }, [open, ref])

    // Close when the route changes
    useEffect(() => { setOpen(false) }, [pathname])

    async function signOut() {
        setSigningOut(true)
        try {
            await fetch('/api/logout', { method: 'POST' })
        } catch {
            // Sign out locally regardless — a failed request should not trap
            // someone in a signed-in state.
        }
        router.push('/')
        router.refresh()
    }

    return (
        <div ref={ref} className="relative">
            <button
                type="button"
                onClick={() => setOpen(o => !o)}
                aria-haspopup="menu"
                aria-expanded={open}
                aria-label="Account menu"
                className="w-9 h-9 rounded-full bg-[#3730a3] text-white text-sm font-bold flex items-center justify-center hover:bg-[#312e81] transition-colors select-none"
            >
                {initials}
            </button>

            {open && (
                <div role="menu" className="absolute right-0 mt-2 w-56 bg-white border border-[#E2E2DA] rounded-xl shadow-xl overflow-hidden z-50">
                    <div className="px-3.5 py-3 border-b border-[#E2E2DA]">
                        <p className="text-[13px] font-semibold text-[#1a1a18] truncate">My Account</p>
                        <p className="text-[11.5px] text-[#6b6b60] truncate">{email}</p>
                    </div>

                    <Link href="/360editor" role="menuitem" className="flex items-center gap-2.5 px-3.5 py-2.5 text-[13px] text-[#1a1a18] hover:bg-[#F4F4EF] no-underline">
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg>
                        Your projects
                    </Link>

                    <button
                        type="button"
                        role="menuitem"
                        onClick={signOut}
                        disabled={signingOut}
                        className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-[13px] text-red-600 hover:bg-red-50 disabled:opacity-60 bg-transparent border-none cursor-pointer text-left"
                    >
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/></svg>
                        {signingOut ? 'Signing out…' : 'Sign out'}
                    </button>
                </div>
            )}
        </div>
    )
}

// Tiny helper so the ref identity is stable for the effect dependency list.
function useRouterSafeRef() {
    const ref = useRef(null)
    return ref
}