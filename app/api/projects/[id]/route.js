// app/api/projects/[id]/route.js
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'

export async function GET(_req, { params }) {
    try {
        const supabase = await createClient()
        const { data: { user }, error: authErr } = await supabase.auth.getUser()
        if (authErr || !user) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })

        const { id } = await params
        const [{ data: project }, { data: scenes }, { data: hotspots }] = await Promise.all([
            supabase
                .from('projects')
                .select('id, name, created_at, logo_url, show_intro, auto_rotate, logo_x, logo_y, logo_size, hotspot_size')
                .eq('id', id)
                .eq('user_id', user.id)
                .single(),
            supabase
                .from('scenes')
                .select('id, project_id, name, storage_path, url, initial_yaw, initial_pitch, initial_hfov, created_at')
                .eq('project_id', id)
                .order('created_at'),
            supabase.from('hotspots')
                .select('id, scene_id, project_id, pitch, yaw, arrow_type, label, target_scene_id')
                .eq('project_id', id),
        ])

        if (!project) return NextResponse.json({ error: 'Project not found.' }, { status: 404 })
        return NextResponse.json({ project, scenes: scenes ?? [], hotspots: hotspots ?? [] })
    } catch (err) {
        return NextResponse.json({ error: err.message || 'Unexpected error.' }, { status: 500 })
    }
}

// update project settings (logo_url, show_intro, auto_rotate) + logo position
export async function PATCH(req, { params }) {
    try {
        const supabase = await createClient()
        const { data: { user }, error: authErr } = await supabase.auth.getUser()
        if (authErr || !user) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })

        const { id } = await params
        const body = await req.json()

        // Only allow safe fields to be patched
        const allowed = ['logo_url', 'show_intro', 'auto_rotate', 'name', 'logo_x', 'logo_y', 'logo_size', 'hotspot_size']
        const updates = Object.fromEntries(
            Object.entries(body).filter(([k]) => allowed.includes(k))
        )
        // Clamp the common hotspot arrow size (px), same range as the panel slider.
        if (updates.hotspot_size != null)
            updates.hotspot_size = Math.min(400, Math.max(40, parseInt(updates.hotspot_size, 10) || 90))
        if (Object.keys(updates).length === 0)
            return NextResponse.json({ error: 'No valid fields.' }, { status: 400 })

        const { data: project, error } = await supabase
            .from('projects')
            .update(updates)
            .eq('id', id)
            .eq('user_id', user.id)
            .select()
            .single()

        if (error) return NextResponse.json({ error: error.message }, { status: 500 })
        if (!project) return NextResponse.json({ error: 'Project not found.' }, { status: 404 })
        return NextResponse.json({ project })
    } catch (err) {
        return NextResponse.json({ error: err.message || 'Unexpected error.' }, { status: 500 })
    }
}

export async function DELETE(_req, { params }) {
    try {
        const supabase = await createClient()
        const { data: { user }, error: authErr } = await supabase.auth.getUser()
        if (authErr || !user) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })

        const { id } = await params
        const { data: project } = await supabase
            .from('projects').select('id').eq('id', id).eq('user_id', user.id).single()
        if (!project) return NextResponse.json({ error: 'Project not found.' }, { status: 404 })

        const { error } = await supabase.from('projects').delete().eq('id', id).eq('user_id', user.id)
        if (error) return NextResponse.json({ error: error.message }, { status: 500 })
        return NextResponse.json({ success: true })
    } catch (err) {
        return NextResponse.json({ error: err.message || 'Unexpected error.' }, { status: 500 })
    }
}