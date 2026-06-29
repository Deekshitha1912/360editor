// app/api/login/route.ts
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'

export async function POST(req) {
    try {
        const { email, password } = await req.json()

        if (!email || !password) {
            return NextResponse.json({ error: 'Email and password are required.' }, { status: 400 })
        }

        const supabase = await createClient()

        const { data, error } = await supabase.auth.signInWithPassword({
            email: email.trim().toLowerCase(),
            password,
        })

        if (error) {
            // Supabase returns generic messages; map to user-friendly ones
            if (
                error.message.toLowerCase().includes('invalid') ||
                error.message.toLowerCase().includes('credentials')
            ) {
                return NextResponse.json({ error: 'Invalid email or password.' }, { status: 401 })
            }

            if (error.message.toLowerCase().includes('email not confirmed')) {
                return NextResponse.json(
                    { error: 'Please confirm your email before signing in.' },
                    { status: 403 }
                )
            }

            return NextResponse.json({ error: error.message }, { status: 400 })
        }

        if (!data.session) {
            return NextResponse.json({ error: 'Could not create session.' }, { status: 500 })
        }

        // Build response and forward the auth cookies set by Supabase SSR client
        const response = NextResponse.json({ success: true }, { status: 200 })
        return response
    } catch (err) {
        return NextResponse.json({ error: err.message || 'Unexpected error.' }, { status: 500 })
    }
}