// app/privacy/page.jsx
// Everything that can be answered from the code is answered. What remains is in
// the OPERATOR block below — your legal identity and contact points, which only
// you can supply. Fill those six strings and the page is complete.
//
// Have it reviewed before launch. This is not legal advice.
import Link from 'next/link'
import { createClient } from '@/lib/supabase-server'
import SiteShell from '@/components/360editor/site/site_shell'
import { LegalPage, F } from '@/components/360editor/site/legal_page'

// ─── FILL THIS IN ────────────────────────────────────────────────────────────
const OPERATOR = {
    name:         '[COMPANY / PROPRIETOR NAME]',
    address:      '[REGISTERED ADDRESS]',
    privacyEmail: '[PRIVACY EMAIL]',
    supportEmail: '[SUPPORT EMAIL]',
    officer:      '[GRIEVANCE OFFICER NAME]',
    officerEmail: '[GRIEVANCE OFFICER EMAIL]',
}
const LAST_UPDATED = '24 July 2026'
// ─────────────────────────────────────────────────────────────────────────────

export const metadata = {
    title: 'Privacy Policy — 360Editor',
    description: 'What 360Editor collects, why, where it is stored, and how to exercise your rights.',
}

export default async function PrivacyPage() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    const sections = [
        {
            id: 'who-we-are',
            title: 'Who we are',
            body: (
                <>
                    <p>
                        360Editor is operated by <F v={OPERATOR.name}/>, <F v={OPERATOR.address}/>. For anything in this
                        policy, write to <F v={OPERATOR.privacyEmail}/>.
                    </p>
                    <p>
                        Under India&apos;s Digital Personal Data Protection Act, 2023, we are the{' '}
                        <strong>data fiduciary</strong> for the personal data described below — we decide why and how it
                        is processed, and we are answerable for it.
                    </p>
                </>
            ),
        },
        {
            id: 'what-we-collect',
            title: 'What we collect',
            body: (
                <>
                    <ul>
                        <li><strong>Account data</strong> — your email address, and your first and last name if you give them.</li>
                        <li><strong>Authentication data</strong> — your password is handled by Supabase Auth and stored only as a cryptographic hash. We never see it, and we cannot recover it for you.</li>
                        <li><strong>Content you upload</strong> — 360° panorama images, logo files, project and scene names, and the labels you write on navigation arrows.</li>
                        <li><strong>Purchase records</strong> — the plan you bought, the order and payment identifiers returned by Razorpay, and your credit balance. <strong>We never receive or store your card, UPI, or bank details</strong> — those are entered with Razorpay and stay with them.</li>
                        <li><strong>A session cookie</strong> — so you stay signed in as you move between pages.</li>
                    </ul>
                    <p>
                        That is the whole list. We run no advertising trackers and no third-party analytics. If that
                        changes, this section changes with it.
                    </p>
                </>
            ),
        },
        {
            id: 'why',
            title: 'Why we process it, and on what basis',
            body: (
                <>
                    <ul>
                        <li><strong>To run your account</strong> — signing you in, showing your projects, keeping your credit balance correct.</li>
                        <li><strong>To provide the service</strong> — storing your panoramas and serving the tours you build from them.</li>
                        <li><strong>To take payment</strong> — creating and verifying orders and granting credits once a payment clears.</li>
                        <li><strong>To contact you</strong> — password resets, and messages about your account or a purchase.</li>
                    </ul>
                    <p>
                        You give consent for these purposes when you create an account, and each of them is also a
                        <em> certain legitimate use</em> under the DPDP Act, being data you voluntarily provided for a
                        service you asked us to deliver. We do not process your data for anything beyond the list above.
                    </p>
                    <p>
                        You can withdraw consent at any time by asking us to close your account — see section 7. Doing
                        so ends the service, since we cannot run it without this data.
                    </p>
                </>
            ),
        },
        {
            id: 'published-tours',
            title: 'Published tours are public',
            body: (
                <>
                    <p>
                        This is the part worth reading twice. When you publish a tour it becomes reachable at a public
                        URL, and <strong>anyone holding that link can open it</strong> — no login, no password. That is
                        the point of the feature, but it means anything visible in your panoramas is visible to whoever
                        you send the link to, and to anyone they forward it to.
                    </p>
                    <p>
                        The panorama and logo images are served from public storage URLs, so they stay directly
                        reachable while the project exists, even outside the tour page.
                    </p>
                    <p>
                        Unpublishing takes the page offline immediately. Deleting the project removes its images from
                        storage. Before publishing a space, check the panoramas for anything you would not hand to a
                        stranger — papers on a desk, a face at a window, a name plate, a vehicle number plate. Once a
                        link is out, you cannot control who receives it.
                    </p>
                </>
            ),
        },
        {
            id: 'storage',
            title: 'Where it is stored, and for how long',
            body: (
                <>
                    <p>
                        Account records and project data sit in a managed Postgres database, and your images in the
                        associated object storage, both provided by Supabase. The application runs on Vercel. Both are
                        international providers, so your data may be processed outside India.
                    </p>
                    <p>
                        We keep your account and its content for as long as your account is open. Deleting a project
                        removes its scenes, arrows, and stored images, and takes any published tour offline. To close
                        your account and have the remainder erased, write to <F v={OPERATOR.privacyEmail}/>.
                    </p>
                    <p>
                        Purchase records are kept for eight years after the financial year they relate to, as Indian
                        accounting and tax law requires, even once an account is closed.
                    </p>
                </>
            ),
        },
        {
            id: 'processors',
            title: 'Who else handles your data',
            body: (
                <>
                    <p>Four providers, each handling only their own part:</p>
                    <ul>
                        <li><strong>Supabase</strong> — database, authentication, file storage, and the account emails we send (password resets and sign-up confirmations).</li>
                        <li><strong>Vercel</strong> — application hosting and delivery.</li>
                        <li><strong>Razorpay</strong> — payment processing. Their own terms govern the payment details you enter with them.</li>
                        <li><strong>Google Fonts</strong> — the typefaces on our public pages, loaded from Google&apos;s servers, which receives your IP address as part of that request.</li>
                    </ul>
                    <p>We do not sell your personal data, and we do not share it for anyone else&apos;s advertising.</p>
                </>
            ),
        },
        {
            id: 'your-rights',
            title: 'Your rights',
            body: (
                <>
                    <p>Under the DPDP Act you may ask us to:</p>
                    <ul>
                        <li><strong>Access</strong> — tell you what personal data of yours we hold and who we have shared it with.</li>
                        <li><strong>Correct</strong> — fix anything inaccurate or incomplete.</li>
                        <li><strong>Erase</strong> — delete your data, except what we must keep for tax and accounting.</li>
                        <li><strong>Nominate</strong> — name someone to exercise these rights if you die or become incapacitated.</li>
                        <li><strong>Withdraw consent</strong> — and have us stop processing.</li>
                    </ul>
                    <p>
                        Write to <F v={OPERATOR.privacyEmail}/>. We will respond within 30 days, and may first ask you
                        to confirm your identity so we do not hand your data to someone else.
                    </p>
                </>
            ),
        },
        {
            id: 'grievance',
            title: 'Grievance Officer',
            body: (
                <>
                    <p>The DPDP Act requires a named contact for complaints about how your data is handled:</p>
                    <p>
                        <F v={OPERATOR.officer}/> · <F v={OPERATOR.officerEmail}/>
                    </p>
                    <p>
                        We will acknowledge a complaint within 7 days and resolve it within 30. If you are not satisfied
                        with our answer, you may take it to the Data Protection Board of India.
                    </p>
                </>
            ),
        },
        {
            id: 'security',
            title: 'Security',
            body: (
                <p>
                    Traffic to the service is encrypted in transit, passwords are stored only as hashes, and database
                    access rules restrict every project to the account that owns it. No service is immune to breach; if
                    one occurs and affects your data, we will notify you and the Data Protection Board as the Act
                    requires.
                </p>
            ),
        },
        {
            id: 'children',
            title: 'Age',
            body: (
                <p>
                    360Editor is for adults. You must be 18 or older to create an account, and we do not knowingly
                    collect data from anyone younger. If you believe a minor has created an account, tell us at{' '}
                    <F v={OPERATOR.privacyEmail}/> and we will remove it.
                </p>
            ),
        },
        {
            id: 'changes',
            title: 'Changes to this policy',
            body: (
                <p>
                    If we change how we handle your data, we will update this page and move the date at the top. Where a
                    change is significant, we will email you before it takes effect.
                </p>
            ),
        },
        {
            id: 'contact',
            title: 'Contact',
            body: (
                <p>
                    Privacy questions: <F v={OPERATOR.privacyEmail}/>. Anything else about the product:{' '}
                    <F v={OPERATOR.supportEmail}/>. Our terms are at <Link href="/terms">Terms of Service</Link>.
                </p>
            ),
        },
    ]

    return (
        <SiteShell user={user ? { email: user.email } : null} active="/privacy">
            <LegalPage
                title="Privacy Policy"
                updated={LAST_UPDATED}
                intro="What 360Editor collects when you build a tour, where it goes, who else can see it, and what you can ask us to do about it."
                sections={sections}
            />
        </SiteShell>
    )
}