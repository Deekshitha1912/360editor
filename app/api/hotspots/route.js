// app/api/hotspots/route.js
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'

export async function POST(req) {
    try {
        const supabase = await createClient()
        const { data: { user }, error: authErr } = await supabase.auth.getUser()
        if (authErr || !user) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })

        const body = await req.json()
        const { project_id, scene_id, pitch, yaw, arrow_type, label, target_scene_id } = body

        if (!project_id || !scene_id || pitch == null || yaw == null)
            return NextResponse.json({ error: 'Missing required fields.' }, { status: 400 })

        // 1) Project must belong to the user
        const { data: project } = await supabase
            .from('projects').select('id').eq('id', project_id).eq('user_id', user.id).single()
        if (!project) return NextResponse.json({ error: 'Project not found.' }, { status: 404 })

        // 2) scene_id (and target_scene_id, if set) must belong to THIS project.
        //    Without this, a hotspot could point at another project's scene.
        const ids = [scene_id]
        if (target_scene_id) ids.push(target_scene_id)
        const { data: validScenes } = await supabase
            .from('scenes').select('id').eq('project_id', project_id).in('id', ids)
        const validIds = new Set((validScenes ?? []).map(s => s.id))

        if (!validIds.has(scene_id))
            return NextResponse.json({ error: 'scene_id does not belong to this project.' }, { status: 400 })
        if (target_scene_id && !validIds.has(target_scene_id))
            return NextResponse.json({ error: 'target_scene_id does not belong to this project.' }, { status: 400 })

        const { data: hotspot, error } = await supabase
            .from('hotspots')
            .insert({ project_id, scene_id, pitch, yaw, arrow_type, label: label || '', target_scene_id })
            .select().single()

        if (error) return NextResponse.json({ error: error.message }, { status: 500 })
        return NextResponse.json({ hotspot }, { status: 201 })
    } catch (err) {
        return NextResponse.json({ error: err.message || 'Unexpected error.' }, { status: 500 })
    }
}