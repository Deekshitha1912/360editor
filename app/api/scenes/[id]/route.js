// app/api/scenes/[id]/route.js
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'

// PATCH — save initial camera position for a scene
export async function PATCH(req, { params }) {
    try {
        const supabase = await createClient()
        const { data: { user }, error: authErr } = await supabase.auth.getUser()
        if (authErr || !user) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })

        const { id } = await params
        const body = await req.json()

        const allowed = ['initial_yaw', 'initial_pitch', 'initial_hfov', 'name']
        const updates = Object.fromEntries(
            Object.entries(body).filter(([k]) => allowed.includes(k))
        )
        if (Object.keys(updates).length === 0)
            return NextResponse.json({ error: 'No valid fields.' }, { status: 400 })

        // Verify ownership through project join
        const { data: scene, error } = await supabase
            .from('scenes')
            .update(updates)
            .eq('id', id)
            .select('*, projects!inner(user_id)')
            .eq('projects.user_id', user.id)
            .single()

        if (error) return NextResponse.json({ error: error.message }, { status: 500 })
        if (!scene) return NextResponse.json({ error: 'Scene not found.' }, { status: 404 })
        return NextResponse.json({ scene })
    } catch (err) {
        return NextResponse.json({ error: err.message || 'Unexpected error.' }, { status: 500 })
    }
}

// DELETE — remove a scene (called from scene_panel already via supabase-client directly,
// but having this here lets you optionally route through API instead)
export async function DELETE(_req, { params }) {
    try {
        const supabase = await createClient()
        const { data: { user }, error: authErr } = await supabase.auth.getUser()
        if (authErr || !user) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })

        const { id } = await params
        const { data: scene } = await supabase
            .from('scenes')
            .select('id, storage_path, projects!inner(user_id)')
            .eq('id', id)
            .eq('projects.user_id', user.id)
            .single()

        if (!scene) return NextResponse.json({ error: 'Scene not found.' }, { status: 404 })

        // Remove from storage
        if (scene.storage_path) {
            await supabase.storage.from('scenes').remove([scene.storage_path])
        }

        const { error } = await supabase.from('scenes').delete().eq('id', id)
        if (error) return NextResponse.json({ error: error.message }, { status: 500 })
        return NextResponse.json({ success: true })
    } catch (err) {
        return NextResponse.json({ error: err.message || 'Unexpected error.' }, { status: 500 })
    }
}