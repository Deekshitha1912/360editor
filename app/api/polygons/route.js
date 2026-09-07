// app/api/polygons/route.js
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { normalizePoints, normalizeStatus, normalizeLabel, normalizeDetail, normalizeCustomColor, normalizeEdgeLengths, MAX_POLYGONS_PER_SCENE } from '@/lib/polygons'
import { normalizeActionType, clampText } from '@/lib/actions'

export async function POST(req) {
    try {
        const supabase = await createClient()
        const { data: { user }, error: authErr } = await supabase.auth.getUser()
        if (authErr || !user) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })

        const body = await req.json()
        const {
            project_id, scene_id, points, status, label, detail, custom_color, edge_lengths,
            action_type, target_scene_id, link_url, info_body, info_image_url, toggle_target_id, start_hidden,
        } = body

        if (!project_id || !scene_id || points == null)
            return NextResponse.json({ error: 'Missing required fields.' }, { status: 400 })

        // 1) Project must belong to the user
        const { data: project } = await supabase
            .from('projects').select('id').eq('id', project_id).eq('user_id', user.id).single()
        if (!project) return NextResponse.json({ error: 'Project not found.' }, { status: 404 })

        // 2) scene_id (and target_scene_id, if set) must belong to THIS
        // project — same two-part check hotspots' own POST route does.
        const sceneIds = [scene_id]
        if (target_scene_id) sceneIds.push(target_scene_id)
        const { data: validScenes } = await supabase
            .from('scenes').select('id').eq('project_id', project_id).in('id', sceneIds)
        const validSceneIds = new Set((validScenes ?? []).map(s => s.id))

        if (!validSceneIds.has(scene_id))
            return NextResponse.json({ error: 'scene_id does not belong to this project.' }, { status: 400 })
        if (target_scene_id && !validSceneIds.has(target_scene_id))
            return NextResponse.json({ error: 'target_scene_id does not belong to this project.' }, { status: 400 })

        // 3) toggle_target_id, if set, must be a hotspot on THIS SAME scene
        // — a toggle target on a different scene wouldn't have a marker to
        // hide/show in the current viewer.
        if (toggle_target_id) {
            const { data: targetHotspot } = await supabase
                .from('hotspots').select('id').eq('id', toggle_target_id).eq('scene_id', scene_id).single()
            if (!targetHotspot)
                return NextResponse.json({ error: 'toggle_target_id does not belong to this scene.' }, { status: 400 })
        }

        // 4) Sanitise the shape — a malformed points array drops the whole
        // request rather than silently distorting the polygon.
        const cleanPoints = normalizePoints(points)
        if (!cleanPoints) return NextResponse.json({ error: 'points must be an array of at least 3 [yaw, pitch] pairs.' }, { status: 400 })

        // 5) Per-scene cap.
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
                custom_color: normalizeCustomColor(custom_color),
                edge_lengths: normalizeEdgeLengths(edge_lengths, cleanPoints.length),
                action_type: normalizeActionType(action_type, 'info'),
                target_scene_id: target_scene_id || null,
                link_url: clampText(link_url, 2000), info_body: clampText(info_body, 4000),
                info_image_url: clampText(info_image_url, 2000),
                toggle_target_id: toggle_target_id || null, start_hidden: !!start_hidden,
            })
            .select().single()

        if (error) return NextResponse.json({ error: error.message }, { status: 500 })
        return NextResponse.json({ polygon }, { status: 201 })
    } catch (err) {
        return NextResponse.json({ error: err.message || 'Unexpected error.' }, { status: 500 })
    }
}
