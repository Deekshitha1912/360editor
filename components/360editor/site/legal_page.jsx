// components/360editor/site/legal_page.jsx
// Single-column layout for /privacy and /terms, plus <F> — the one thing that
// still needs your input.
//
// <F v={OPERATOR.name}/> prints the value plainly once it is real, and prints an
// amber chip while it still looks like "[SOMETHING]". So the pages read normally
// the moment you fill the config block at the top of each file, and are
// impossible to ship half-finished by accident.
//
// Before launch:  grep -rn "\[" app/privacy/page.jsx app/terms/page.jsx
import Link from 'next/link'

export function F({ v }) {
    const unfilled = typeof v === 'string' && v.trim().startsWith('[')
    if (!unfilled) return <>{v}</>
    return (
        <span
            title="Fill this in before launch"
            className="inline-flex items-center rounded-md border border-amber-300 bg-amber-100 px-1.5 py-[1px] text-[12.5px] font-semibold text-amber-800"
        >
            {v}
        </span>
    )
}

export function LegalPage({ title, updated, intro, sections }) {
    return (
        <div className="max-w-3xl mx-auto px-6 py-14">

            <div className="mb-10 pb-8 border-b border-[#E2E2DA]">
                <h1 className="serif text-[clamp(30px,4.2vw,42px)] font-semibold text-[#1a1a18] tracking-[-1px] leading-tight mb-3">
                    {title}
                </h1>
                <p className="text-[13px] text-[#6b6b60]">Last updated: {updated}</p>
                {intro && (
                    <p className="mt-5 text-[15px] text-[#3a3a35] leading-relaxed">{intro}</p>
                )}
            </div>

            {sections.map((s, i) => (
                <section key={s.id} id={s.id} className="scroll-mt-[84px] mb-9 last:mb-0">
                    <h2 className="flex items-baseline gap-2.5 text-[17px] font-semibold text-[#1a1a18] mb-3">
                        <span className="text-[13px] font-bold text-[#3730a3] tabular-nums">{i + 1}</span>
                        {s.title}
                    </h2>
                    <div className="space-y-3 text-[14.5px] text-[#3a3a35] leading-[1.75] [&_a]:text-[#3730a3] [&_a]:no-underline hover:[&_a]:underline [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-1.5 [&_strong]:font-semibold [&_strong]:text-[#1a1a18]">
                        {s.body}
                    </div>
                </section>
            ))}

            <div className="mt-12 pt-6 border-t border-[#E2E2DA] flex flex-wrap items-center gap-x-5 gap-y-2 text-[13px] text-[#6b6b60]">
                <Link href="/privacy" className="hover:text-[#3730a3]">Privacy Policy</Link>
                <Link href="/terms" className="hover:text-[#3730a3]">Terms of Service</Link>
                <Link href="/pricing" className="hover:text-[#3730a3]">Pricing</Link>
                <Link href="/" className="ml-auto hover:text-[#3730a3]">← Back home</Link>
            </div>
        </div>
    )
}