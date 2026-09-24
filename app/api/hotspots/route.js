// app/api/hotspots/route.js
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import {
    clampHotspotSize, clampHotspotRotation, normalizeHotspotColor, normalizeLabelColor,
    clampHotspotAngle, normalizeActionType, clampText, normalizeZIndex,
} from '@/lib/hotspots'
import { normalizeInfoFields } from '@/lib/actions'

export async function POST(req) {
    try {
        const supabase = await createClient()
        const { data: { user }, error: authErr } = await supabase.auth.getUser()
        if (authErr || !user) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })

        const body = await req.json()
        const {
            project_id, scene_id, pitch, yaw, arrow_type, label, target_scene_id, size, rotation,
            color, label_color, rotate_x, rotate_y, z_index,
            action_type, link_url, info_body, info_image_url, info_fields, toggle_target_id, start_hidden, animate_line,
            custom_icon_url,
        } = body

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

        // 3) toggle_target_id, if set, must be another hotspot on THIS SAME
        //    scene — a toggle target on a different scene wouldn't even have
        //    a marker to hide/show in the current viewer.
        if (toggle_target_id) {
            const { data: targetHotspot } = await supabase
                .from('hotspots').select('id').eq('id', toggle_target_id).eq('scene_id', scene_id).single()
            if (!targetHotspot)
                return NextResponse.json({ error: 'toggle_target_id does not belong to this scene.' }, { status: 400 })
        }

        const { data: hotspot, error } = await supabase
            .from('hotspots')
            .insert({
                project_id, scene_id, pitch, yaw, arrow_type, label: label || '', target_scene_id,
                size: clampHotspotSize(size), rotation: clampHotspotRotation(rotation),
                color: normalizeHotspotColor(color), label_color: normalizeLabelColor(label_color),
                rotate_x: clampHotspotAngle(rotate_x, 90), rotate_y: clampHotspotAngle(rotate_y, 0),
                z_index: normalizeZIndex(z_index),
                action_type: normalizeActionType(action_type),
                link_url: clampText(link_url, 2000), info_body: clampText(info_body, 4000),
                info_image_url: clampText(info_image_url, 2000),
                info_fields: normalizeInfoFields(info_fields),
                toggle_target_id: toggle_target_id || null, start_hidden: !!start_hidden,
                animate_line: animate_line == null ? true : !!animate_line,
                custom_icon_url: clampText(custom_icon_url, 2000),
            })
            .select().single()

        if (error) return NextResponse.json({ error: error.message }, { status: 500 })
        return NextResponse.json({ hotspot }, { status: 201 })
    } catch (err) {
        return NextResponse.json({ error: err.message || 'Unexpected error.' }, { status: 500 })
    }
}