// app/api/polygons/route.js
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { normalizePoints, normalizeStatus, normalizeLabel, normalizeDetail, MAX_POLYGONS_PER_SCENE } from '@/lib/polygons'

export async function POST(req) {
    try {
        const supabase = await createClient()
        const { data: { user }, error: authErr } = await supabase.auth.getUser()
        if (authErr || !user) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })

        const body = await req.json()
        const { project_id, scene_id, points, status, label, detail } = body

        if (!project_id || !scene_id || points == null)
            return NextResponse.json({ error: 'Missing required fields.' }, { status: 400 })

        // 1) Project must belong to the user
        const { data: project } = await supabase
            .from('projects').select('id').eq('id', project_id).eq('user_id', user.id).single()
        if (!project) return NextResponse.json({ error: 'Project not found.' }, { status: 404 })

        // 2) scene_id must belong to THIS project.
        const { data: scene } = await supabase
            .from('scenes').select('id').eq('id', scene_id).eq('project_id', project_id).single()
        if (!scene) return NextResponse.json({ error: 'scene_id does not belong to this project.' }, { status: 400 })

        // 3) Sanitise the shape — a malformed points array drops the whole
        // request rather than silently distorting the polygon.
        const cleanPoints = normalizePoints(points)
        if (!cleanPoints) return NextResponse.json({ error: 'points must be an array of at least 3 [yaw, pitch] pairs.' }, { status: 400 })

        // 4) Per-scene cap.
        const { count } = await supabase
            .from('polygons').select('id', { count: 'exact', head: true }).eq('scene_id', scene_id)
        if ((count ?? 0) >= MAX_POLYGONS_PER_SCENE)
            return NextResponse.json({ error: `Limit of ${MAX_POLYGONS_PER_SCENE} zones per scene reached.` }, { status: 400 })

        const { data: polygon, error } = await supabase
            .from('polygons')
            .insert({
                project_id, scene_id,
                points: cleanPoints,
                status: normalizeStatus(status),
                label:  normalizeLabel(label),
                detail: normalizeDetail(detail),
            })
            .select().single()

        if (error) return NextResponse.json({ error: error.message }, { status: 500 })
        return NextResponse.json({ polygon }, { status: 201 })
    } catch (err) {
        return NextResponse.json({ error: err.message || 'Unexpected error.' }, { status: 500 })
    }
}
