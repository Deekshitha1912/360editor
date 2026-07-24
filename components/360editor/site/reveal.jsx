'use client'
// components/360editor/site/reveal.jsx
//
// Drives the [data-reveal] scroll animation.
//
// WHY THIS IS A COMPONENT AND NOT A <Script>
// It used to be an inline next/script with strategy="afterInteractive". That
// script runs ONCE, on the first full page load. Clicking a <Link> in the App
// Router is a soft navigation — no reload, no re-execution — so on the second
// page the IntersectionObserver was never installed, nothing ever got the `.in`
// class, and every [data-reveal] block stayed at opacity: 0. The page looked
// empty until you pressed reload, which is exactly the bug this replaces.
//
// As a component it re-runs on every navigation, because it re-mounts with the
// page. usePathname() is the belt-and-braces: even if React reuses the instance,
// the effect re-fires when the route changes.
import { useEffect } from 'react'
import { usePathname } from 'next/navigation'

export default function Reveal() {
    const pathname = usePathname()

    useEffect(() => {
        const els = Array.from(document.querySelectorAll('[data-reveal]:not(.in)'))
        if (!els.length) return

        // No observer support (or it throws) → show everything rather than
        // leaving the page blank. Invisible content is never the better failure.
        if (typeof IntersectionObserver === 'undefined') {
            els.forEach(el => el.classList.add('in'))
            return
        }

        let observer
        try {
            observer = new IntersectionObserver(
                entries => {
                    entries.forEach(entry => {
                        if (entry.isIntersecting) {
                            entry.target.classList.add('in')
                            observer.unobserve(entry.target)
                        }
                    })
                },
                { threshold: 0.12 }
            )
            els.forEach(el => observer.observe(el))
        } catch {
            els.forEach(el => el.classList.add('in'))
            return
        }

        return () => observer.disconnect()
    }, [pathname])

    return null
}