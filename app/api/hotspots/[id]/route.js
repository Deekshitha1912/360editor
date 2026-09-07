// app/api/hotspots/[id]/route.js
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import {
    clampHotspotSize, clampHotspotRotation, normalizeHotspotColor, normalizeLabelColor,
    clampHotspotAngle, normalizeActionType, clampText,
} from '@/lib/hotspots'

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

        const allowed = [
            'label', 'target_scene_id', 'pitch', 'yaw', 'arrow_type', 'size', 'rotation',
            'color', 'label_color', 'rotate_x', 'rotate_y',
            'action_type', 'link_url', 'info_body', 'info_image_url', 'toggle_target_id', 'start_hidden',
            'animate_line',
        ]
        const updates = Object.fromEntries(
            Object.entries(body).filter(([k]) => allowed.includes(k))
        )

        if (Object.keys(updates).length === 0) {
            return NextResponse.json({ error: 'No valid fields.' }, { status: 400 })
        }

        if ('size'            in updates) updates.size            = clampHotspotSize(updates.size)
        if ('rotation'        in updates) updates.rotation        = clampHotspotRotation(updates.rotation)
        if ('color'           in updates) updates.color           = normalizeHotspotColor(updates.color)
        if ('label_color'     in updates) updates.label_color     = normalizeLabelColor(updates.label_color)
        if ('rotate_x'        in updates) updates.rotate_x        = clampHotspotAngle(updates.rotate_x, 90)
        if ('rotate_y'        in updates) updates.rotate_y        = clampHotspotAngle(updates.rotate_y, 0)
        if ('action_type'     in updates) updates.action_type     = normalizeActionType(updates.action_type)
        if ('link_url'        in updates) updates.link_url        = clampText(updates.link_url, 2000)
        if ('info_body'       in updates) updates.info_body       = clampText(updates.info_body, 4000)
        if ('info_image_url'  in updates) updates.info_image_url  = clampText(updates.info_image_url, 2000)
        if ('toggle_target_id' in updates) updates.toggle_target_id = updates.toggle_target_id || null
        if ('start_hidden'    in updates) updates.start_hidden    = !!updates.start_hidden
        if ('animate_line'    in updates) updates.animate_line    = !!updates.animate_line

        // Step 1: fetch the hotspot
        const { data: hotspot, error: fetchErr } = await supabase
            .from('hotspots')
            .select('id, project_id, scene_id')
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

        // toggle_target_id, if being set, must be another hotspot on THIS
        // SAME scene — see the identical check in POST /api/hotspots.
        if (updates.toggle_target_id) {
            const { data: targetHotspot } = await supabase
                .from('hotspots').select('id').eq('id', updates.toggle_target_id).eq('scene_id', hotspot.scene_id).single()
            if (!targetHotspot)
                return NextResponse.json({ error: 'toggle_target_id does not belong to this scene.' }, { status: 400 })
        }

        // Step 3: update
        const { data: updated, error: updateErr } = await supabase
            .from('hotspots')
            .update(updates)
            .eq('id', id)
            .select(`
                id, scene_id, project_id, pitch, yaw, arrow_type, label, target_scene_id, size, rotation,
                color, label_color, rotate_x, rotate_y,
                action_type, link_url, info_body, info_image_url, toggle_target_id, start_hidden, animate_line
            `)
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