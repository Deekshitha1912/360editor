// app/api/projects/[id]/overlay-image/route.js
//
// Upload / delete the IMAGE FILE behind an overlay. It does not touch the
// project row — the caller stores the returned URL inside projects.overlays or
// scenes.coverups and saves that separately.
//
// This is the generalised replacement for /api/projects/[id]/logo, which
// uploaded a file and wrote logo_url in one step. With several overlays that
// coupling no longer works: you can add three logos and two cover-ups, and the
// row they belong to isn't always `projects`.
//
// Files live under overlays/<projectId>-<timestamp>.<ext> in the public scenes
// bucket, so a published tour can load them without a signed URL.
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'

const BUCKET    = 'scenes'
const MARKER    = `/object/public/${BUCKET}/`
const MAX_BYTES = 5 * 1024 * 1024   // 5 MB

function pathFromUrl(url) {
    if (!url || typeof url !== 'string') return null
    const i = url.indexOf(MARKER)
    return i === -1 ? null : decodeURIComponent(url.slice(i + MARKER.length))
}

// Only ever delete a file this project itself uploaded. Without this check a
// crafted url could remove another user's panoramas.
function ownOverlayPath(projectId, url) {
    const p = pathFromUrl(url)
    if (!p) return null
    return (p.startsWith(`overlays/${projectId}-`) || p.startsWith(`logos/${projectId}-`)) ? p : null
}

async function assertOwner(supabase, userId, projectId) {
    const { data } = await supabase
        .from('projects').select('id').eq('id', projectId).eq('user_id', userId).single()
    return !!data
}

// POST — multipart/form-data { file }  →  { url }
export async function POST(req, { params }) {
    try {
        const supabase = await createClient()
        const { data: { user }, error: authErr } = await supabase.auth.getUser()
        if (authErr || !user) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })

        const { id } = await params
        if (!await assertOwner(supabase, user.id, id))
            return NextResponse.json({ error: 'Project not found.' }, { status: 404 })

        const form = await req.formData()
        const file = form.get('file')
        if (!file || typeof file === 'string')
            return NextResponse.json({ error: 'No file provided.' }, { status: 400 })
        if (!file.type || !file.type.startsWith('image/'))
            return NextResponse.json({ error: 'File must be an image.' }, { status: 400 })
        if (file.size > MAX_BYTES)
            return NextResponse.json({ error: 'Image must be 5 MB or smaller.' }, { status: 400 })

        const ext  = (file.name?.split('.').pop() || 'png').toLowerCase().replace(/[^a-z0-9]/g, '')
        const path = `overlays/${id}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext || 'png'}`

        const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, file, {
            cacheControl: '3600', upsert: false, contentType: file.type,
        })
        if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 })

        const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(path)
        return NextResponse.json({ url: pub.publicUrl })
    } catch (err) {
        return NextResponse.json({ error: err.message || 'Unexpected error.' }, { status: 500 })
    }
}

// DELETE — { url }  →  { success: true }
// Best-effort: a failed storage removal must never block the caller from
// dropping the overlay out of its array. An orphaned file is cheaper than an
// overlay the user cannot delete.
export async function DELETE(req, { params }) {
    try {
        const supabase = await createClient()
        const { data: { user }, error: authErr } = await supabase.auth.getUser()
        if (authErr || !user) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })

        const { id } = await params
        if (!await assertOwner(supabase, user.id, id))
            return NextResponse.json({ error: 'Project not found.' }, { status: 404 })

        const { url } = await req.json().catch(() => ({}))
        const path = ownOverlayPath(id, url)

        if (path) {
            try {
                const { error: rmErr } = await supabase.storage.from(BUCKET).remove([path])
                if (rmErr) console.error('[overlay-image] storage delete failed:', rmErr.message)
            } catch (e) {
                console.error('[overlay-image] storage delete threw:', e?.message)
            }
        }

        return NextResponse.json({ success: true })
    } catch (err) {
        return NextResponse.json({ error: err.message || 'Unexpected error.' }, { status: 500 })
    }
}