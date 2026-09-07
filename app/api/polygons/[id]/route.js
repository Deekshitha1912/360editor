// app/api/polygons/[id]/route.js
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { normalizePoints, normalizeStatus, normalizeLabel, normalizeDetail, normalizeCustomColor, normalizeEdgeLengths } from '@/lib/polygons'
import { normalizeActionType, clampText } from '@/lib/actions'

// Ownership is checked with its own SELECT, then the write is a plain update
// scoped by id — never an embedded-join filter on the UPDATE itself. See
// app/api/scenes/[id]/route.js's comment for why: a filter on an embedded
// resource constrains the RETURNED representation, not which rows the write
// touches, so the write would go ahead unguarded.
async function ownedPolygon(supabase, userId, polygonId) {
    const { data, error } = await supabase
        .from('polygons')
        .select('id, project_id, scene_id, points, projects!inner(user_id)')
        .eq('id', polygonId)
        .eq('projects.user_id', userId)
        .maybeSingle()
    return { polygon: data, error }
}

export async function PATCH(req, { params }) {
    try {
        const supabase = await createClient()
        const { data: { user }, error: authErr } = await supabase.auth.getUser()
        if (authErr || !user) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })

        const { id } = await params
        if (!id) return NextResponse.json({ error: 'Missing polygon id.' }, { status: 400 })

        let body
        try { body = await req.json() }
        catch { return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 }) }

        const updates = {}
        if ('points' in body) {
            const clean = normalizePoints(body.points)
            if (!clean) return NextResponse.json({ error: 'points must be an array of at least 3 [yaw, pitch] pairs.' }, { status: 400 })
            updates.points = clean
        }
        if ('status' in body) updates.status = normalizeStatus(body.status)
        if ('label'  in body) updates.label  = normalizeLabel(body.label)
        if ('detail' in body) updates.detail = normalizeDetail(body.detail)
        if ('custom_color' in body) updates.custom_color = normalizeCustomColor(body.custom_color)
        // edge_lengths must be padded/truncated to match the zone's point
        // count, which may not be known yet (it's only in `body.points` if
        // this same request is also changing the shape) — normalized below,
        // once the owned row (with its current points) has been fetched.
        const rawEdgeLengths = 'edge_lengths' in body ? body.edge_lengths : undefined
        if ('action_type'      in body) updates.action_type      = normalizeActionType(body.action_type, 'info')
        if ('target_scene_id'  in body) updates.target_scene_id  = body.target_scene_id || null
        if ('link_url'         in body) updates.link_url         = clampText(body.link_url, 2000)
        if ('info_body'        in body) updates.info_body        = clampText(body.info_body, 4000)
        if ('info_image_url'   in body) updates.info_image_url   = clampText(body.info_image_url, 2000)
        if ('toggle_target_id' in body) updates.toggle_target_id = body.toggle_target_id || null
        if ('start_hidden'     in body) updates.start_hidden     = !!body.start_hidden

        if (Object.keys(updates).length === 0 && rawEdgeLengths === undefined)
            return NextResponse.json({ error: 'No valid fields.' }, { status: 400 })
        updates.updated_at = new Date().toISOString()

        const { polygon: owned, error: ownErr } = await ownedPolygon(supabase, user.id, id)
        if (ownErr) {
            console.error('[polygons PATCH] ownership lookup failed:', ownErr.code, ownErr.message)
            return NextResponse.json({ error: 'Could not verify the zone.' }, { status: 500 })
        }
        if (!owned) return NextResponse.json({ error: 'Zone not found.' }, { status: 404 })

        if (rawEdgeLengths !== undefined) {
            const pointCount = (updates.points ?? owned.points ?? []).length
            updates.edge_lengths = normalizeEdgeLengths(rawEdgeLengths, pointCount)
        }

        // target_scene_id must belong to the SAME project; toggle_target_id
        // must be a hotspot on the SAME scene — same two checks POST does.
        if (updates.target_scene_id) {
            const { data: scene } = await supabase
                .from('scenes').select('id').eq('id', updates.target_scene_id).eq('project_id', owned.project_id).single()
            if (!scene) return NextResponse.json({ error: 'target_scene_id does not belong to this project.' }, { status: 400 })
        }
        if (updates.toggle_target_id) {
            const { data: targetHotspot } = await supabase
                .from('hotspots').select('id').eq('id', updates.toggle_target_id).eq('scene_id', owned.scene_id).single()
            if (!targetHotspot)
                return NextResponse.json({ error: 'toggle_target_id does not belong to this scene.' }, { status: 400 })
        }

        // No .single() on a possibly-empty update — a 0-row result from a
        // rejecting RLS policy is a condition to report, not throw on. Same
        // reasoning as app/api/scenes/[id]/route.js's PATCH handler.
        const { data: rows, error } = await supabase
            .from('polygons')
            .update(updates)
            .eq('id', id)
            .select(`
                id, scene_id, project_id, points, status, label, detail, custom_color, edge_lengths,
                action_type, target_scene_id, link_url, info_body, info_image_url, toggle_target_id, start_hidden
            `)

        if (error) {
            console.error('[polygons PATCH] update failed:', error.code, error.message)
            return NextResponse.json({ error: 'Could not save the zone.' }, { status: 500 })
        }
        if (!rows?.length) {
            console.error('[polygons PATCH] update affected 0 rows for polygon', id, '— owned by this user but rejected by RLS.')
            return NextResponse.json({ error: 'The zone could not be updated.' }, { status: 403 })
        }

        return NextResponse.json({ polygon: rows[0] })
    } catch (err) {
        console.error('PATCH /api/polygons/[id] crashed:', err)
        return NextResponse.json({ error: err?.message || 'Unexpected error.' }, { status: 500 })
    }
}

export async function DELETE(_req, { params }) {
    try {
        const supabase = await createClient()
        const { data: { user }, error: authErr } = await supabase.auth.getUser()
        if (authErr || !user) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })

        const { id } = await params

        const { polygon: owned, error: ownErr } = await ownedPolygon(supabase, user.id, id)
        if (ownErr || !owned) return NextResponse.json({ error: 'Zone not found.' }, { status: 404 })

        const { error } = await supabase.from('polygons').delete().eq('id', id)
        if (error) return NextResponse.json({ error: error.message }, { status: 500 })

        return NextResponse.json({ success: true })
    } catch (err) {
        return NextResponse.json({ error: err?.message || 'Unexpected error.' }, { status: 500 })
    }
}
