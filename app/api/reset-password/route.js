// app/api/reset-password/route.js
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'

export async function POST(req) {
    try {
        const { password } = await req.json()
        if (!password || password.length < 8)
            return NextResponse.json({ error: 'Password must be at least 8 characters.' }, { status: 400 })

        const supabase = await createClient()

        // The recovery session was set by /auth/callback. No session = bad/expired link.
        const { data: { user }, error: authErr } = await supabase.auth.getUser()
        if (authErr || !user) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })

        const { error } = await supabase.auth.updateUser({ password })
        if (error) return NextResponse.json({ error: error.message }, { status: 400 })

        return NextResponse.json({ success: true })
    } catch (err) {
        return NextResponse.json({ error: err.message || 'Unexpected error.' }, { status: 500 })
    }
}