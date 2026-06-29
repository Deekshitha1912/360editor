// app/api/projects/[id]/logo/route.js
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

// Only allow deleting a file that is THIS project's own logo.
// Prevents a crafted url/old_url from deleting other scenes or other users' files.
function ownLogoPath(id, url) {
    const p = pathFromUrl(url)
    return p && p.startsWith(`logos/${id}-`) ? p : null
}

// Upload (or replace) the project logo. multipart/form-data: { file, old_url? }
export async function POST(req, { params }) {
    try {
        const supabase = await createClient()
        const { data: { user }, error: authErr } = await supabase.auth.getUser()
        if (authErr || !user) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })

        const { id } = await params

        const { data: project } = await supabase
            .from('projects').select('id').eq('id', id).eq('user_id', user.id).single()
        if (!project) return NextResponse.json({ error: 'Project not found.' }, { status: 404 })

        const form = await req.formData()
        const file = form.get('file')
        if (!file || typeof file === 'string')
            return NextResponse.json({ error: 'No file provided.' }, { status: 400 })
        if (!file.type || !file.type.startsWith('image/'))
            return NextResponse.json({ error: 'File must be an image.' }, { status: 400 })
        if (file.size > MAX_BYTES)
            return NextResponse.json({ error: 'Image must be 5 MB or smaller.' }, { status: 400 })

        const ext  = (file.name?.split('.').pop() || 'png').toLowerCase()
        const path = `logos/${id}-${Date.now()}.${ext}`

        const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, file, {
            cacheControl: '3600', upsert: false, contentType: file.type,
        })
        if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 })

        const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(path)

        const oldPath = ownLogoPath(id, form.get('old_url'))
        if (oldPath) { try { await supabase.storage.from(BUCKET).remove([oldPath]) } catch {} }

        // Persist immediately so the logo is live without a separate "Save settings".
        const { data: updated, error: updErr } = await supabase
            .from('projects').update({ logo_url: pub.publicUrl })
            .eq('id', id).eq('user_id', user.id).select().single()
        if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 })

        return NextResponse.json({ url: pub.publicUrl, project: updated })
    } catch (err) {
        return NextResponse.json({ error: err.message || 'Unexpected error.' }, { status: 500 })
    }
}

// Remove the project logo: delete the file from storage AND clear the columns.
// Body: { url }  →  returns { project }
export async function DELETE(req, { params }) {
    try {
        const supabase = await createClient()
        const { data: { user }, error: authErr } = await supabase.auth.getUser()
        if (authErr || !user) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })

        const { id } = await params
        const { url } = await req.json().catch(() => ({}))

        // Ownership check on the project.
        const { data: project } = await supabase
            .from('projects').select('id').eq('id', id).eq('user_id', user.id).single()
        if (!project) return NextResponse.json({ error: 'Project not found.' }, { status: 404 })

        // Delete the file only if it is genuinely this project's own logo.
        // Storage removal is best-effort — never block clearing the columns on it.
        const path = ownLogoPath(id, url)
        if (path) {
            try {
                const { error: rmErr } = await supabase.storage.from(BUCKET).remove([path])
                if (rmErr) console.error('logo storage delete failed:', rmErr.message)
            } catch (e) {
                console.error('logo storage delete threw:', e?.message)
            }
        }

        // Clear the logo columns and return the updated row.
        const { data: updated, error: updErr } = await supabase
            .from('projects')
            .update({ logo_url: null, logo_x: 50, logo_y: 50, logo_size: 160 })
            .eq('id', id).eq('user_id', user.id)
            .select().single()
        if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 })

        return NextResponse.json({ project: updated })
    } catch (err) {
        return NextResponse.json({ error: err.message || 'Unexpected error.' }, { status: 500 })
    }
}