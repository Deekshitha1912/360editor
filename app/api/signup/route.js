// app/api/signup/route.js — profile creation handled by the DB trigger
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { createAdminClient } from '@/lib/supabase-admin'

// A key/config failure is not the user's fault and must not be shown to them as
// a validation message. These fragments identify it.
function isKeyProblem(message = '') {
    const m = message.toLowerCase()
    return (
        m.includes('invalid jwt') ||
        m.includes('unrecognized jwt kid') ||
        m.includes('signing method') ||
        m.includes('invalid api key') ||
        m.includes('unable to parse or verify signature')
    )
}

export async function POST(req) {
    try {
        const { firstName, lastName, email, password } = await req.json()

        if (!email || !password || !firstName)
            return NextResponse.json({ error: 'First name, email, and password are required.' }, { status: 400 })
        if (password.length < 8)
            return NextResponse.json({ error: 'Password must be at least 8 characters.' }, { status: 400 })

        const trimmedEmail = email.trim().toLowerCase()
        const trimmedFirst = firstName.trim()
        const trimmedLast  = (lastName ?? '').trim()

        // ─────────────────────────────────────────────────────────────────────
        // EMAIL VERIFICATION — TEMPORARILY DISABLED
        //
        // Accounts are created pre-verified (email_confirm: true) via the admin
        // client below, which sends NO confirmation email. To re-enable email
        // verification: delete the admin `createUser` block below and uncomment
        // this original `signUp` block (also make sure "Confirm email" is ON in
        // the Supabase Auth settings).
        //
        // const supabase = await createClient()
        //
        // const { data: authData, error: authErr } = await supabase.auth.signUp({
        //     email: trimmedEmail,
        //     password,
        //     options: { data: { first_name: trimmedFirst, last_name: trimmedLast } },
        // })
        // ─────────────────────────────────────────────────────────────────────

        // ── AUTO-VERIFY (no email) — remove this block when re-enabling above ──
        // NOTE: admin.auth.admin.* is the strictest consumer of the secret key in
        // the whole app. If the key is a revoked legacy service_role JWT, this is
        // where it surfaces first — see lib/supabase-admin.js.
        const admin = createAdminClient()

        const { data: authData, error: authErr } = await admin.auth.admin.createUser({
            email: trimmedEmail,
            password,
            email_confirm: true, // marks the email confirmed AND suppresses the email
            user_metadata: { first_name: trimmedFirst, last_name: trimmedLast },
        })
        // ──────────────────────────────────────────────────────────────────────

        if (authErr) {
            const msg = authErr.message?.toLowerCase() ?? ''

            if (authErr.code === 'email_exists' || msg.includes('already') || msg.includes('registered') || msg.includes('exists'))
                return NextResponse.json({ error: 'already_exists' }, { status: 409 })

            // Server misconfiguration — log it loudly, tell the user nothing
            // about our keys, and do NOT dress it up as a 400 validation error.
            if (isKeyProblem(authErr.message)) {
                console.error(
                    '[signup] Supabase rejected the secret key:', authErr.message,
                    '\n  → Dashboard → Settings → API Keys → copy the sb_secret_... value into',
                    'SUPABASE_SECRET_KEY (.env.local AND the Vercel environment), then redeploy.'
                )
                return NextResponse.json(
                    { error: 'Sign-up is temporarily unavailable. Please try again shortly.' },
                    { status: 503 }
                )
            }

            return NextResponse.json({ error: authErr.message }, { status: 400 })
        }

        if (!authData?.user?.id)
            return NextResponse.json({ error: 'already_exists' }, { status: 409 })

        return NextResponse.json({ success: true }, { status: 200 })
    } catch (err) {
        // createAdminClient() throws here when the key is absent entirely.
        console.error('[signup] unexpected error:', err)
        const configIssue = /secret key missing|publishable key missing|NEXT_PUBLIC_SUPABASE_URL/.test(err.message || '')
        return NextResponse.json(
            { error: configIssue ? 'Sign-up is temporarily unavailable. Please try again shortly.' : (err.message || 'Unexpected error.') },
            { status: configIssue ? 503 : 500 }
        )
    }
}