// app/api/project/route.js
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'

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

        const { data: project, error } = await supabase
            .from('projects')
            .insert({ name: name.trim(), user_id: user.id })
            .select('id, name, created_at')
            .single()

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 })
        }

        return NextResponse.json({ project }, { status: 201 })
    } catch (err) {
        return NextResponse.json({ error: err.message || 'Unexpected error.' }, { status: 500 })
    }
}