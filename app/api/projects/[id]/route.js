// app/api/projects/[id]/route.js
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { normalizeLogos, normalizeCoverups } from '@/lib/overlays'

export async function GET(_req, { params }) {
    try {
        const supabase = await createClient()
        const { data: { user }, error: authErr } = await supabase.auth.getUser()
        if (authErr || !user) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })

        const { id } = await params
        const [projectRes, scenesRes, hotspotsRes, polygonsRes] = await Promise.all([
            supabase
                .from('projects')
                .select('id, name, created_at, show_intro, auto_rotate, hotspot_size, overlays, coverups, slug, published_at')
                .eq('id', id)
                .eq('user_id', user.id)
                .single(),
            supabase
                .from('scenes')
                .select('id, project_id, name, storage_path, url, initial_yaw, initial_pitch, initial_hfov, created_at')
                .eq('project_id', id)
                .order('created_at'),
            supabase.from('hotspots')
                .select('id, scene_id, project_id, pitch, yaw, arrow_type, label, target_scene_id, size, rotation')
                .eq('project_id', id),
            supabase.from('polygons')
                .select('id, scene_id, project_id, points, status, label, detail')
                .eq('project_id', id),
        ])

        // A missing column, a broken RLS policy and a genuinely absent project
        // all arrive here as `data: null`. Returning 404 for all three sent us
        // hunting for a deleted row when the real answer was an unmigrated
        // database — so separate them before answering.
        // polygonsRes.error is deliberately NOT included here: the polygons
        // table may not exist yet on a database that hasn't had
        // db/001_create_polygons.sql applied, and a project should still load
        // (with zero zones) rather than fail outright over a missing table.
        const dbError = projectRes.error || scenesRes.error || hotspotsRes.error
        if (dbError && dbError.code !== 'PGRST116') {   // PGRST116 = .single() found no row
            console.error('[projects GET] query failed:', dbError.code, dbError.message)
            // 42703 = undefined_column — the schema is behind the code.
            const schemaBehind = dbError.code === '42703' || /column .* does not exist/i.test(dbError.message || '')
            return NextResponse.json(
                {
                    error: schemaBehind
                        ? 'The database is missing a column this build expects. Run the pending migration.'
                        : 'Could not load the project.',
                    detail: process.env.NODE_ENV === 'production' ? undefined : dbError.message,
                },
                { status: 500 }
            )
        }

        const project  = projectRes.data
        const scenes   = scenesRes.data
        const hotspots = hotspotsRes.data
        const polygons = polygonsRes.error ? [] : polygonsRes.data

        if (!project) return NextResponse.json({ error: 'Project not found.' }, { status: 404 })

        // Live tour link, built server-side so the browser never needs the user id.
        // null while the project has never been published (or was unpublished).
        const origin    = (process.env.NEXT_PUBLIC_SITE_URL || new URL(_req.url).origin).replace(/\/+$/, '')
        const publicUrl = project.published_at && project.slug
            ? `${origin}/${user.id}/${project.slug}`
            : null

        return NextResponse.json({
            project,
            scenes:     scenes ?? [],
            hotspots:   hotspots ?? [],
            polygons:   polygons ?? [],
            public_url: publicUrl,
        })
    } catch (err) {
        return NextResponse.json({ error: err.message || 'Unexpected error.' }, { status: 500 })
    }
}

// update project settings (show_intro, auto_rotate, name) + overlays
export async function PATCH(req, { params }) {
    try {
        const supabase = await createClient()
        const { data: { user }, error: authErr } = await supabase.auth.getUser()
        if (authErr || !user) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })

        const { id } = await params
        const body = await req.json()

        // Only allow safe fields to be patched
        // logo_url / logo_x / logo_y / logo_size were dropped by
        // db/overlays_cleanup.sql — logos live in `overlays` now.
        const allowed = ['show_intro', 'auto_rotate', 'name', 'hotspot_size']
        const updates = Object.fromEntries(
            Object.entries(body).filter(([k]) => allowed.includes(k))
        )

        // Screen-anchored logos. Sanitised server-side — the client decides
        // layout, never what is structurally valid. normalizeLogos returns null
        // when the value isn't an array, which we treat as "no update" rather
        // than "wipe the column".
        if ('overlays' in body) {
            const overlays = normalizeLogos(body.overlays)
            if (!overlays) return NextResponse.json({ error: 'overlays must be an array.' }, { status: 400 })
            updates.overlays = overlays
        }

        // Sphere-anchored cover-ups. Each carries a scene_id (null = every scene).
        if ('coverups' in body) {
            const coverups = normalizeCoverups(body.coverups)
            if (!coverups) return NextResponse.json({ error: 'coverups must be an array.' }, { status: 400 })
            updates.coverups = coverups
        }
        // Clamp the common hotspot arrow size (px), same range as the panel slider.
        if (updates.hotspot_size != null)
            updates.hotspot_size = Math.min(400, Math.max(40, parseInt(updates.hotspot_size, 10) || 90))
        if (Object.keys(updates).length === 0)
            return NextResponse.json({ error: 'No valid fields.' }, { status: 400 })

        // No .single(): an update that matches no row is a condition to report,
        // not an exception to throw. .single() on a 0-row update throws
        // "Cannot coerce the result to a single JSON object" and surfaces as a
        // 500 — which is exactly why overlays failed to save while hotspots (a
        // different route) succeeded.
        const { data: rows, error } = await supabase
            .from('projects')
            .update(updates)
            .eq('id', id)
            .eq('user_id', user.id)
            .select()

        if (error) {
            console.error('[projects PATCH] update failed:', error.code, error.message)
            const schemaBehind = error.code === '42703' || /column .* does not exist/i.test(error.message || '')
            return NextResponse.json(
                {
                    error: schemaBehind
                        ? 'The database is missing a column this build expects. Run the pending migration.'
                        : 'Could not save the project.',
                    detail: process.env.NODE_ENV === 'production' ? undefined : error.message,
                },
                { status: 500 }
            )
        }

        if (!rows?.length) {
            // The row exists and is owned by this user (the editor loaded it), yet
            // the update changed nothing → an UPDATE row-level-security policy on
            // public.projects is rejecting the write. This is the overlay-save bug.
            console.error(
                '[projects PATCH] update affected 0 rows for project', id,
                '— the row is owned by this user but the write was rejected. Add/repair the',
                'UPDATE policy on public.projects (needs both USING and WITH CHECK). See',
                'db/projects_update_policy.sql.'
            )
            return NextResponse.json(
                { error: 'The project could not be updated. Check the update policy on the projects table.' },
                { status: 403 }
            )
        }

        return NextResponse.json({ project: rows[0] })
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