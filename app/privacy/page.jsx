// app/privacy/page.jsx
// TODO: Scaffolding only. DPDP Act requires specifics + a named grievance officer.
// Get reviewed before launch. Not legal advice.
import Link from 'next/link'

export default function PrivacyPage() {
    return (
        <div className="min-h-screen bg-[#FAFAF7] px-6 py-16">
            <div className="max-w-2xl mx-auto">
                <Link href="/" className="text-[13px] text-[#3730a3] font-medium no-underline hover:text-[#312e81]">← Back home</Link>
                <h1 className="text-[32px] font-semibold text-[#1a1a18] mt-6 mb-2" style={{ fontFamily: "'Fraunces', Georgia, serif" }}>Privacy Policy</h1>
                <p className="text-[13px] text-[#6b6b60] mb-8">Last updated: [DATE]</p>
                <div className="space-y-6 text-[14px] text-[#3a3a35] leading-relaxed">
                    <section><h2 className="font-semibold text-[#1a1a18] mb-1">1. Who we are</h2><p>[COMPANY / NAME], [ADDRESS], [EMAIL]. We are the data fiduciary for the data below.</p></section>
                    <section><h2 className="font-semibold text-[#1a1a18] mb-1">2. What we collect</h2><p>Account data (name, email), authentication data, and content you upload (panoramas, project details). [Add analytics/cookies if used.]</p></section>
                    <section><h2 className="font-semibold text-[#1a1a18] mb-1">3. Why, and on what basis</h2><p>[Purpose per category + lawful basis / consent under DPDP.]</p></section>
                    <section><h2 className="font-semibold text-[#1a1a18] mb-1">4. Storage & retention</h2><p>Stored with [Supabase / region]. Uploaded images are served via public URLs from our storage. [Retention periods.]</p></section>
                    <section><h2 className="font-semibold text-[#1a1a18] mb-1">5. Processors</h2><p>[List sub-processors: Supabase, hosting, email provider.]</p></section>
                    <section><h2 className="font-semibold text-[#1a1a18] mb-1">6. Your rights</h2><p>Access, correction, erasure, grievance redressal. [How to exercise them.]</p></section>
                    <section><h2 className="font-semibold text-[#1a1a18] mb-1">7. Grievance Officer</h2><p>[NAME], [EMAIL] — required under the DPDP Act.</p></section>
                </div>
            </div>
        </div>
    )
}