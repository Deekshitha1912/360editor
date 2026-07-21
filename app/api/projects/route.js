// app/api/project/route.js
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { consumeCredit, refundCredit } from '@/lib/credits'

export async function POST(req) {
    try {
        const supabase = await createClient()

        const { data: { user }, error: authErr } = await supabase.auth.getUser()
        if (authErr || !user) {
            return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
        }

        const { name } = await req.json()
        if (!name?.trim()) {
            return NextResponse.json({ error: 'Project name is required.' }, { status: 400 })
        }

        // Spend one credit BEFORE creating the project. This is atomic
        // (row-locked in the DB), so two rapid requests can't double-spend.
        const ok = await consumeCredit(user.id)
        if (!ok) {
            return NextResponse.json(
                { error: 'You have no credits left. Buy a plan to create a new tour.' },
                { status: 402 } // Payment Required
            )
        }

        const { data: project, error } = await supabase
            .from('projects')
            .insert({ name: name.trim(), user_id: user.id })
            .select('id, name, created_at')
            .single()

        if (error) {
            // Creation failed after we spent the credit — give it back.
            await refundCredit(user.id)
            return NextResponse.json({ error: error.message }, { status: 500 })
        }

        return NextResponse.json({ project }, { status: 201 })
    } catch (err) {
        return NextResponse.json({ error: err.message || 'Unexpected error.' }, { status: 500 })
    }
}