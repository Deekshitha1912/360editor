// app/terms/page.jsx
// Product mechanics are accurate to the code. Commercial defaults (refunds,
// liability cap, jurisdiction) are written out rather than left blank — read
// them, change what you disagree with, and have the document reviewed before
// launch. This is not legal advice.
import Link from 'next/link'
import { createClient } from '@/lib/supabase-server'
import SiteShell from '@/components/360editor/site/site_shell'
import { LegalPage, F } from '@/components/360editor/site/legal_page'

// ─── FILL THIS IN ────────────────────────────────────────────────────────────
const OPERATOR = {
    name:         '[COMPANY / PROPRIETOR NAME]',
    address:      '[REGISTERED ADDRESS]',
    supportEmail: '[SUPPORT EMAIL]',
}
const JURISDICTION = { city: 'Chennai', state: 'Tamil Nadu' }
const LAST_UPDATED = '24 July 2026'
// ─────────────────────────────────────────────────────────────────────────────

export const metadata = {
    title: 'Terms of Service — 360Editor',
    description: 'The agreement between you and 360Editor: accounts, credits, your content, and publishing.',
}

export default async function TermsPage() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    const sections = [
        {
            id: 'acceptance',
            title: 'Acceptance',
            body: (
                <p>
                    360Editor is operated by <F v={OPERATOR.name}/>, <F v={OPERATOR.address}/> (&ldquo;we&rdquo;,
                    &ldquo;us&rdquo;). By creating an account or using the service you agree to these terms. If you are
                    using 360Editor for a company, you confirm you may accept these terms on its behalf. You must be 18
                    or older to hold an account.
                </p>
            ),
        },
        {
            id: 'the-service',
            title: 'What the service does',
            body: (
                <>
                    <p>
                        360Editor lets you upload 360° panorama images, link them together with navigation arrows, brand
                        the result with your logo, and then publish the finished tour to a public link we host or
                        download it as a standalone HTML file.
                    </p>
                    <p>
                        Current limits are 30 panoramas per tour and 50 MB per image. We may change these; if we reduce
                        a limit, tours you have already built are unaffected.
                    </p>
                    <p>
                        The service is developing quickly. Features may be added, changed, or withdrawn, and we will not
                        always be able to warn you first.
                    </p>
                </>
            ),
        },
        {
            id: 'accounts',
            title: 'Your account',
            body: (
                <>
                    <p>
                        You need an account to build tours. Keep your password to yourself — everything done through
                        your account is your responsibility. Tell us promptly if you believe someone else has access.
                    </p>
                    <p>
                        Give accurate details when you sign up and keep your email current: it is how we reach you about
                        purchases and password resets. One account per person or business; do not share logins.
                    </p>
                </>
            ),
        },
        {
            id: 'credits',
            title: 'Credits and payment',
            body: (
                <>
                    <p>
                        The service runs on credits. <strong>One credit creates one tour.</strong> The credit is spent at
                        the moment you create the project — not when you publish — and it is not returned if you later
                        delete that project. Once the project exists you may edit, publish, unpublish, re-publish, and
                        download it as often as you like at no further cost.
                    </p>
                    <p>
                        Prices are shown on the <Link href="/pricing">pricing page</Link> in Indian rupees and are
                        inclusive of applicable taxes. Payments are processed by Razorpay; credits are added only after
                        the payment is verified on our side. If money leaves your account and no credit appears, write
                        to <F v={OPERATOR.supportEmail}/> with the payment reference and we will resolve it.
                    </p>
                    <p>
                        <strong>Refunds.</strong> Unused credits can be refunded within 7 days of purchase — write to us
                        and we will return them to the original payment method within 10 working days. A credit already
                        spent on creating a project cannot be refunded, because the tour it paid for has been delivered.
                        Where a payment succeeded but no credit was granted, we refund it in full regardless of timing.
                    </p>
                    <p>Credits do not expire. They carry no cash value and cannot be transferred between accounts.</p>
                </>
            ),
        },
        {
            id: 'your-content',
            title: 'Your content',
            body: (
                <>
                    <p>
                        <strong>Your panoramas and tours remain yours.</strong> We claim no ownership over anything you
                        upload or build.
                    </p>
                    <p>
                        To run the service you grant us a non-exclusive, worldwide, royalty-free licence to store,
                        reproduce, and transmit your content — solely to host it, show it to you in the editor, and
                        serve the tours you choose to publish. The licence lasts only while the content is on the
                        service and ends when you delete it.
                    </p>
                    <p>
                        We will not use your tours as examples in our own marketing unless you agree to it in writing
                        first.
                    </p>
                    <p>
                        You confirm you hold the rights to everything you upload, including permission to photograph and
                        publish the spaces shown and any consent needed from people appearing in the images.
                    </p>
                </>
            ),
        },
        {
            id: 'publishing',
            title: 'Publishing and downloads',
            body: (
                <>
                    <p>
                        Publishing puts your tour at a public URL. Anyone with the link can open it — published tours
                        carry no password, and links can be forwarded. What goes into a tour you publish is your
                        decision and your responsibility.
                    </p>
                    <p>
                        Unpublishing takes the page offline. We may also take a published tour offline if it breaches
                        section 7, and we will tell you when we do.
                    </p>
                    <p>
                        A downloaded HTML file is yours to host anywhere. Note that it loads its panorama and logo
                        images from our storage rather than embedding them, so it keeps working only while the project
                        still exists in your account. If you need a copy that survives independently, keep your original
                        image files.
                    </p>
                </>
            ),
        },
        {
            id: 'acceptable-use',
            title: 'Acceptable use',
            body: (
                <>
                    <p>Do not use 360Editor to:</p>
                    <ul>
                        <li>Upload content you do not hold the rights to, or that infringes anyone&apos;s copyright or trademark.</li>
                        <li>Publish content that is unlawful, obscene, defamatory, or that invades someone&apos;s privacy.</li>
                        <li>Photograph and publish spaces you do not have permission to photograph and publish.</li>
                        <li>Break, overload, probe, or reverse-engineer the service, or work around its limits.</li>
                        <li>Resell or share access to the service itself. Building tours for your own clients and charging them for that work is expressly fine — that is what the product is for. Reselling accounts or credits is not.</li>
                    </ul>
                </>
            ),
        },
        {
            id: 'availability',
            title: 'Availability',
            body: (
                <p>
                    We work to keep the service running but do not offer an uptime guarantee. Maintenance, third-party
                    outages, and faults happen, and the service is provided without a service-level commitment.
                </p>
            ),
        },
        {
            id: 'termination',
            title: 'Suspension and termination',
            body: (
                <>
                    <p>
                        You may stop using 360Editor whenever you like and ask us to close your account. Deleting a
                        project removes its scenes, arrows, and images, and takes any published tour offline.
                    </p>
                    <p>
                        We may suspend or close an account that breaches these terms. Where circumstances allow, we will
                        warn you first and give you a chance to put it right. If you close your account yourself, unused
                        credits are refundable under section 4. If we close it for a breach, unused credits are
                        forfeited.
                    </p>
                </>
            ),
        },
        {
            id: 'liability',
            title: 'Disclaimers and liability',
            body: (
                <>
                    <p>
                        The service is provided as it is. We do not warrant that it will meet every requirement or run
                        without fault.
                    </p>
                    <p>
                        To the extent the law allows, our total liability for any claim arising from these terms or the
                        service is limited to the amount you paid us in the twelve months before the claim arose. We are
                        not liable for lost profits, lost business, or loss of data. Nothing here limits liability that
                        cannot lawfully be limited.
                    </p>
                    <p>
                        Keep your own copies of important panoramas. We are not a backup service.
                    </p>
                </>
            ),
        },
        {
            id: 'changes',
            title: 'Changes to these terms',
            body: (
                <p>
                    We may update these terms as the product changes. The date at the top shows the current version, and
                    we will email you before a significant change takes effect. Continuing to use the service after that
                    means you accept the update.
                </p>
            ),
        },
        {
            id: 'governing-law',
            title: 'Governing law',
            body: (
                <p>
                    These terms are governed by the laws of India, and the courts at {JURISDICTION.city},{' '}
                    {JURISDICTION.state} have exclusive jurisdiction over any dispute arising from them.
                </p>
            ),
        },
        {
            id: 'contact',
            title: 'Contact',
            body: (
                <p>
                    Write to <F v={OPERATOR.supportEmail}/>. How we handle your data is set out in our{' '}
                    <Link href="/privacy">Privacy Policy</Link>.
                </p>
            ),
        },
    ]

    return (
        <SiteShell user={user ? { email: user.email } : null} active="/terms">
            <LegalPage
                title="Terms of Service"
                updated={LAST_UPDATED}
                intro="The agreement between you and 360Editor — what you get, what a credit buys, what happens to the tours you build, and what we each owe the other."
                sections={sections}
            />
        </SiteShell>
    )
}