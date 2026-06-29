// app/api/hotspots/[id]/route.js
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'

export async function PATCH(req, { params }) {
    try {
        const supabase = await createClient()

        const { data: { user }, error: authErr } = await supabase.auth.getUser()
        if (authErr || !user) {
            return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
        }

        // params may need to be awaited in Next.js 15
        const resolvedParams = await Promise.resolve(params)
        const id = resolvedParams.id

        if (!id) {
            return NextResponse.json({ error: 'Missing hotspot id.' }, { status: 400 })
        }

        let body
        try {
            body = await req.json()
        } catch {
            return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 })
        }

        const allowed = ['label', 'target_scene_id', 'pitch', 'yaw', 'arrow_type']
        const updates = Object.fromEntries(
            Object.entries(body).filter(([k]) => allowed.includes(k))
        )

        if (Object.keys(updates).length === 0) {
            return NextResponse.json({ error: 'No valid fields.' }, { status: 400 })
        }

        // Step 1: fetch the hotspot
        const { data: hotspot, error: fetchErr } = await supabase
            .from('hotspots')
            .select('id, project_id')
            .eq('id', id)
            .single()

        if (fetchErr) {
            return NextResponse.json({ error: 'Fetch error: ' + fetchErr.message }, { status: 500 })
        }
        if (!hotspot) {
            return NextResponse.json({ error: 'Hotspot not found.' }, { status: 404 })
        }

        // Step 2: verify ownership
        const { data: project, error: projErr } = await supabase
            .from('projects')
            .select('id')
            .eq('id', hotspot.project_id)
            .eq('user_id', user.id)
            .single()

        if (projErr) {
            return NextResponse.json({ error: 'Project fetch error: ' + projErr.message }, { status: 500 })
        }
        if (!project) {
            return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
        }

        // Step 3: update
        const { data: updated, error: updateErr } = await supabase
            .from('hotspots')
            .update(updates)
            .eq('id', id)
            .select('id, scene_id, project_id, pitch, yaw, arrow_type, label, target_scene_id')
            .single()

        if (updateErr) {
            return NextResponse.json({ error: 'Update error: ' + updateErr.message }, { status: 500 })
        }

        return NextResponse.json({ hotspot: updated })

    } catch (err) {
        console.error('PATCH /api/hotspots/[id] crashed:', err)
        return NextResponse.json({ error: err?.message || 'Unexpected error.' }, { status: 500 })
    }
}

export async function DELETE(_req, { params }) {
    try {
        const supabase = await createClient()

        const { data: { user }, error: authErr } = await supabase.auth.getUser()
        if (authErr || !user) {
            return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
        }

        const resolvedParams = await Promise.resolve(params)
        const id = resolvedParams.id

        const { data: hotspot, error: fetchErr } = await supabase
            .from('hotspots')
            .select('id, project_id')
            .eq('id', id)
            .single()

        if (fetchErr || !hotspot) {
            return NextResponse.json({ error: 'Hotspot not found.' }, { status: 404 })
        }

        const { data: project, error: projErr } = await supabase
            .from('projects')
            .select('id')
            .eq('id', hotspot.project_id)
            .eq('user_id', user.id)
            .single()

        if (projErr || !project) {
            return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
        }

        const { error: deleteErr } = await supabase
            .from('hotspots')
            .delete()
            .eq('id', id)

        if (deleteErr) {
            return NextResponse.json({ error: deleteErr.message }, { status: 500 })
        }

        return NextResponse.json({ success: true })

    } catch (err) {
        return NextResponse.json({ error: err?.message || 'Unexpected error.' }, { status: 500 })
    }
}