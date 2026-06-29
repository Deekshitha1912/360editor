// app/api/signup/route.js — profile creation now handled by the DB trigger
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'

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

        const supabase = await createClient()

        const { data: authData, error: authErr } = await supabase.auth.signUp({
            email: trimmedEmail,
            password,
            options: { data: { first_name: trimmedFirst, last_name: trimmedLast } },
        })

        if (authErr) {
            if (authErr.message.toLowerCase().includes('already registered'))
                return NextResponse.json({ error: 'already_exists' }, { status: 409 })
            return NextResponse.json({ error: authErr.message }, { status: 400 })
        }
        if (!authData?.user?.id)
            return NextResponse.json({ error: 'already_exists' }, { status: 409 })

        return NextResponse.json({ success: true }, { status: 200 })
    } catch (err) {
        console.error('[signup] unexpected error:', err)
        return NextResponse.json({ error: err.message || 'Unexpected error.' }, { status: 500 })
    }
}