// app/api/projects/[id]/publish/route.js
//
// POST   → publish (or re-publish) the tour to its permanent public URL
//          https://<site>/<user_id>/<project-slug>
// DELETE → unpublish (URL returns 404; the slug stays reserved so a later
//          re-publish gives back the exact same link)
//
// Publishing writes a FROZEN SNAPSHOT of the tour into projects.published_payload.
// That is deliberate: the client-facing link only changes when the user clicks
// Publish, so half-finished edits never appear on a link already shared.

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { uniqueSlug } from '@/lib/slug'
import { isPublishCycleExpired } from '@/lib/publish-cycle'

// Fields the public renderer needs — nothing else is snapshotted.
const PROJECT_FIELDS = 'id, name, show_intro, auto_rotate, hotspot_size, overlays, coverups'

function siteOrigin(req) {
    const configured = process.env.NEXT_PUBLIC_SITE_URL
    if (configured) return configured.replace(/\/+$/, '')
    return new URL(req.url).origin
}

export async function POST(req, { params }) {
    try {
        const supabase = await createClient()
        const { data: { user }, error: authErr } = await supabase.auth.getUser()
        if (authErr || !user) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })

        const { id } = await params

        // Ownership + current publish state (RLS also scopes this to the user).
        const { data: project } = await supabase
            .from('projects')
            .select(`${PROJECT_FIELDS}, slug, published_at, publish_cycle_started_at`)
            .eq('id', id)
            .eq('user_id', user.id)
            .single()
        if (!project) return NextResponse.json({ error: 'Project not found.' }, { status: 404 })

        // One credit buys this project a 1-year publishing window, not
        // unlimited hosting forever — see lib/publish-cycle.js. Past that,
        // publishing (and republishing) is blocked until POST
        // /api/projects/[id]/renew spends another credit to reset the clock.
        if (isPublishCycleExpired(project.publish_cycle_started_at)) {
            return NextResponse.json(
                { error: "This tour's 1-year hosting window has ended. Renew it to keep publishing.", code: 'cycle_expired' },
                { status: 402 }
            )
        }

        const [{ data: scenes }, { data: hotspots }, polygonsRes] = await Promise.all([
            supabase
                .from('scenes')
                .select('id, project_id, name, url, initial_yaw, initial_pitch, initial_hfov, created_at')
                .eq('project_id', id)
                .order('created_at'),
            supabase
                .from('hotspots')
                // color/label_color/rotate_x/rotate_y were missing here even
                // though export.jsx reads all four (h.color, h.rotateX/Y) —
                // an oversight from when those columns were added elsewhere
                // (app/api/projects/[id]/route.js's own hotspots select, used
                // by the editor) but never mirrored into this separate
                // publish-snapshot query. Fixed alongside adding the new
                // action_type/link_url/etc. fields below, since it's the
                // exact same query.
                .select('id, scene_id, project_id, pitch, yaw, arrow_type, label, target_scene_id, size, rotation, color, label_color, rotate_x, rotate_y, action_type, link_url, info_body, info_image_url, info_fields, toggle_target_id, start_hidden, animate_line, custom_icon_url')
                .eq('project_id', id),
            // Not destructured with the others: a database that hasn't had
            // db/001_create_polygons.sql applied yet must still be able to
            // publish (with zero zones), not fail the whole request.
            supabase
                .from('polygons')
                .select('id, scene_id, project_id, points, status, label, detail, custom_color, edge_lengths, action_type, target_scene_id, link_url, info_body, info_image_url, info_fields, toggle_target_id, start_hidden')
                .eq('project_id', id),
        ])
        const polygons = polygonsRes.error ? [] : (polygonsRes.data ?? [])

        if (!scenes?.length)
            return NextResponse.json({ error: 'Add at least one scene before publishing.' }, { status: 400 })

        // Slug is assigned once and then frozen — renaming must not break links.
        const slug = project.slug || await uniqueSlug(supabase, user.id, project.name, id)
        // Set ONCE, on the very first publish — every later republish leaves
        // it untouched, since it's the 1-year window's anchor, not a
        // "last published" timestamp (published_at already is that).
        const cycleStart = project.publish_cycle_started_at || new Date().toISOString()

        const published_payload = {
            v: 2, // v2 adds `polygons` — readers must treat it as optional (?? [])
                  // since a v1 snapshot published before this feature has no such key.
            project: {
                id:           project.id,
                name:         project.name,
                show_intro:   project.show_intro,
                auto_rotate:  project.auto_rotate,
                hotspot_size: project.hotspot_size,
                overlays:     project.overlays ?? [],
                coverups:     project.coverups ?? [],
            },
            scenes,
            hotspots: hotspots ?? [],
            polygons,
        }

        const { data: updated, error } = await supabase
            .from('projects')
            .update({ slug, published_at: new Date().toISOString(), published_payload, publish_cycle_started_at: cycleStart })
            .eq('id', id)
            .eq('user_id', user.id)
            .select('slug, published_at, publish_cycle_started_at')
            .single()

        if (error) {
            // Unique violation on (user_id, slug) — extremely unlikely, but retry once
            // with a suffixed slug rather than failing the publish.
            if (error.code === '23505') {
                const retrySlug = `${slug}-${Date.now().toString(36)}`
                const { data: retry, error: retryErr } = await supabase
                    .from('projects')
                    .update({ slug: retrySlug, published_at: new Date().toISOString(), published_payload, publish_cycle_started_at: cycleStart })
                    .eq('id', id)
                    .eq('user_id', user.id)
                    .select('slug, published_at, publish_cycle_started_at')
                    .single()
                if (retryErr) return NextResponse.json({ error: retryErr.message }, { status: 500 })
                return NextResponse.json({
                    slug: retry.slug,
                    published_at: retry.published_at,
                    publish_cycle_started_at: retry.publish_cycle_started_at,
                    url: `${siteOrigin(req)}/${user.id}/${retry.slug}`,
                })
            }
            return NextResponse.json({ error: error.message }, { status: 500 })
        }

        return NextResponse.json({
            slug: updated.slug,
            published_at: updated.published_at,
            publish_cycle_started_at: updated.publish_cycle_started_at,
            url: `${siteOrigin(req)}/${user.id}/${updated.slug}`,
        })
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

        // Keep `slug` so re-publishing restores the same URL.
        const { error } = await supabase
            .from('projects')
            .update({ published_at: null, published_payload: null })
            .eq('id', id)
            .eq('user_id', user.id)

        if (error) return NextResponse.json({ error: error.message }, { status: 500 })
        return NextResponse.json({ success: true })
    } catch (err) {
        return NextResponse.json({ error: err.message || 'Unexpected error.' }, { status: 500 })
    }
}