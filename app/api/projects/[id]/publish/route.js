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

// Fields the public renderer needs — nothing else is snapshotted.
const PROJECT_FIELDS = 'id, name, logo_url, show_intro, auto_rotate, logo_x, logo_y, logo_size, hotspot_size'

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
            .select(`${PROJECT_FIELDS}, slug, published_at`)
            .eq('id', id)
            .eq('user_id', user.id)
            .single()
        if (!project) return NextResponse.json({ error: 'Project not found.' }, { status: 404 })

        const [{ data: scenes }, { data: hotspots }] = await Promise.all([
            supabase
                .from('scenes')
                .select('id, project_id, name, url, initial_yaw, initial_pitch, initial_hfov, created_at')
                .eq('project_id', id)
                .order('created_at'),
            supabase
                .from('hotspots')
                .select('id, scene_id, project_id, pitch, yaw, arrow_type, label, target_scene_id')
                .eq('project_id', id),
        ])

        if (!scenes?.length)
            return NextResponse.json({ error: 'Add at least one scene before publishing.' }, { status: 400 })

        // Slug is assigned once and then frozen — renaming must not break links.
        const slug = project.slug || await uniqueSlug(supabase, user.id, project.name, id)

        const published_payload = {
            v: 1,
            project: {
                id:           project.id,
                name:         project.name,
                logo_url:     project.logo_url,
                show_intro:   project.show_intro,
                auto_rotate:  project.auto_rotate,
                logo_x:       project.logo_x,
                logo_y:       project.logo_y,
                logo_size:    project.logo_size,
                hotspot_size: project.hotspot_size,
            },
            scenes,
            hotspots: hotspots ?? [],
        }

        const { data: updated, error } = await supabase
            .from('projects')
            .update({ slug, published_at: new Date().toISOString(), published_payload })
            .eq('id', id)
            .eq('user_id', user.id)
            .select('slug, published_at')
            .single()

        if (error) {
            // Unique violation on (user_id, slug) — extremely unlikely, but retry once
            // with a suffixed slug rather than failing the publish.
            if (error.code === '23505') {
                const retrySlug = `${slug}-${Date.now().toString(36)}`
                const { data: retry, error: retryErr } = await supabase
                    .from('projects')
                    .update({ slug: retrySlug, published_at: new Date().toISOString(), published_payload })
                    .eq('id', id)
                    .eq('user_id', user.id)
                    .select('slug, published_at')
                    .single()
                if (retryErr) return NextResponse.json({ error: retryErr.message }, { status: 500 })
                return NextResponse.json({
                    slug: retry.slug,
                    published_at: retry.published_at,
                    url: `${siteOrigin(req)}/${user.id}/${retry.slug}`,
                })
            }
            return NextResponse.json({ error: error.message }, { status: 500 })
        }

        return NextResponse.json({
            slug: updated.slug,
            published_at: updated.published_at,
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