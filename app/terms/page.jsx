// app/terms/page.jsx
// TODO: Scaffolding only. Replace with text reviewed for your jurisdiction
// (India DPDP Act + IT Rules) before launch. Not legal advice.
import Link from 'next/link'

export default function TermsPage() {
    return (
        <div className="min-h-screen bg-[#FAFAF7] px-6 py-16">
            <div className="max-w-2xl mx-auto">
                <Link href="/" className="text-[13px] text-[#3730a3] font-medium no-underline hover:text-[#312e81]">← Back home</Link>
                <h1 className="text-[32px] font-semibold text-[#1a1a18] mt-6 mb-2" style={{ fontFamily: "'Fraunces', Georgia, serif" }}>Terms of Service</h1>
                <p className="text-[13px] text-[#6b6b60] mb-8">Last updated: [DATE]</p>
                <div className="space-y-6 text-[14px] text-[#3a3a35] leading-relaxed">
                    <section><h2 className="font-semibold text-[#1a1a18] mb-1">1. Acceptance</h2><p>By using 360Editor, operated by [COMPANY / PROPRIETOR NAME], [ADDRESS], you agree to these terms.</p></section>
                    <section><h2 className="font-semibold text-[#1a1a18] mb-1">2. The service</h2><p>360Editor lets you create, edit, and export 360° virtual tours. [Note beta status and availability disclaimers.]</p></section>
                    <section><h2 className="font-semibold text-[#1a1a18] mb-1">3. Your account</h2><p>You're responsible for your credentials and activity under your account.</p></section>
                    <section><h2 className="font-semibold text-[#1a1a18] mb-1">4. Your content</h2><p>You retain ownership of panoramas and tours you upload. [Grant the licence you need to host/serve them; acceptable-use rules.]</p></section>
                    <section><h2 className="font-semibold text-[#1a1a18] mb-1">5. Payment</h2><p>[Pricing, billing, refunds — or state it's free during beta.]</p></section>
                    <section><h2 className="font-semibold text-[#1a1a18] mb-1">6. Termination, liability, changes, governing law</h2><p>[Standard clauses. Governing law: [STATE], India.]</p></section>
                    <section><h2 className="font-semibold text-[#1a1a18] mb-1">7. Contact</h2><p>[EMAIL]</p></section>
                </div>
            </div>
        </div>
    )
}