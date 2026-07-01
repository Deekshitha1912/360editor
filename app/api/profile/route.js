// app/api/profile/route.js
// Returns the signed-in user's profile. Keeps the profiles query out of the
// page/server components — both the landing avatar and the dashboard read this.
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'

export async function GET() {
    try {
        const supabase = await createClient()
        const { data: { user }, error: authErr } = await supabase.auth.getUser()
        if (authErr || !user) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })

        const { data: profile } = await supabase
            .from('profiles')
            .select('id, email, first_name, last_name, role')
            .eq('id', user.id)
            .single()

        // Fall back to the auth email if the profile row is missing.
        return NextResponse.json({
            profile: profile ?? { id: user.id, email: user.email, first_name: null, last_name: null, role: null },
        })
    } catch (err) {
        return NextResponse.json({ error: err?.message || 'Unexpected error.' }, { status: 500 })
    }
}