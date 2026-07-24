// components/360editor/site/site_footer.jsx
// Shared footer. Pricing and How it works are real pages now, not #anchors.
import Link from 'next/link'

export default function SiteFooter() {
    return (
        <footer className="border-t border-[#E2E2DA] bg-white">
            <div className="max-w-5xl mx-auto px-6 py-8 flex flex-col sm:flex-row items-center justify-between gap-4">
                <Link href="/" className="flex items-center gap-2.5 no-underline">
                    <div className="w-7 h-7 bg-[#3730a3] rounded-lg flex items-center justify-center">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
                            <circle cx="12" cy="12" r="10"/>
                            <path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
                        </svg>
                    </div>
                    <span className="text-[#1a1a18] font-bold text-[15px]">360<span className="text-[#3730a3]">Editor</span></span>
                </Link>
                <div className="flex items-center gap-6 text-[13px] text-[#6b6b60]">
                    <Link href="/pricing" className="hover:text-[#3730a3]">Pricing</Link>
                    <Link href="/how-it-works" className="hover:text-[#3730a3]">How it works</Link>
                    <Link href="/privacy" className="hover:text-[#3730a3]">Privacy</Link>
                    <Link href="/terms" className="hover:text-[#3730a3]">Terms</Link>
                </div>
                <span className="text-[12.5px] text-[#9a9a8e]">© {new Date().getFullYear()} 360Editor</span>
            </div>
        </footer>
    )
}