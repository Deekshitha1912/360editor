// app/api/forgot-password/route.js
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { createAdminClient } from '@/lib/supabase-admin'

export async function POST(req) {
    try {
        const { email } = await req.json()
        if (!email) return NextResponse.json({ error: 'Email is required.' }, { status: 400 })

        const cleanEmail = email.trim().toLowerCase()
        const origin = req.headers.get('origin') || new URL(req.url).origin

        // Existence check — profiles mirrors auth.users via your signup trigger.
        const admin = createAdminClient()
        const { data: existing } = await admin
            .from('profiles')
            .select('id')
            .eq('email', cleanEmail)
            .maybeSingle()

        if (!existing) {
            return NextResponse.json({ error: 'no_account' }, { status: 404 })
        }

        const supabase = await createClient()
        await supabase.auth.resetPasswordForEmail(cleanEmail, {
            redirectTo: `${origin}/auth/callback?next=/reset_password`,
        })

        return NextResponse.json({ success: true })
    } catch (err) {
        return NextResponse.json({ error: err.message || 'Unexpected error.' }, { status: 500 })
    }
}
