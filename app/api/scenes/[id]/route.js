// app/api/scenes/[id]/route.js
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'

// Everything the editor needs back after a write.
const SCENE_FIELDS =
    'id, project_id, name, storage_path, url, initial_yaw, initial_pitch, initial_hfov, created_at'

// Ownership is checked with its own SELECT, then the write is a plain update.
//
// The previous version did it in one call — .update().select('*, projects!inner(user_id)')
// .eq('projects.user_id', …).single() — which looks tidy and is wrong twice over.
// A filter on an embedded resource constrains the RETURNED REPRESENTATION, not
// the rows the UPDATE touches: the write went ahead unguarded, and when the
// embed filtered the response away .single() failed with
// "Cannot coerce the result to a single JSON object".
async function ownedScene(supabase, userId, sceneId) {
    const { data, error } = await supabase
        .from('scenes')
        .select('id, project_id, projects!inner(user_id)')
        .eq('id', sceneId)
        .eq('projects.user_id', userId)
        .maybeSingle()
    return { scene: data, error }
}

// PATCH — initial camera position and scene name.
export async function PATCH(req, { params }) {
    try {
        const supabase = await createClient()
        const { data: { user }, error: authErr } = await supabase.auth.getUser()
        if (authErr || !user) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })

        const { id } = await params
        const body = await req.json()

        const allowed = ['initial_yaw', 'initial_pitch', 'initial_hfov', 'name']
        const updates = Object.fromEntries(
            Object.entries(body).filter(([k]) => allowed.includes(k))
        )

        if (Object.keys(updates).length === 0)
            return NextResponse.json({ error: 'No valid fields.' }, { status: 400 })

        const { scene: owned, error: ownErr } = await ownedScene(supabase, user.id, id)
        if (ownErr) {
            console.error('[scenes PATCH] ownership lookup failed:', ownErr.code, ownErr.message)
            return NextResponse.json({ error: 'Could not verify the scene.' }, { status: 500 })
        }
        if (!owned) return NextResponse.json({ error: 'Scene not found.' }, { status: 404 })

        // No .single() — an empty result is a condition to report, not an
        // exception to throw. Row-level security silently updating nothing is
        // the single most likely cause, so name it.
        const { data: rows, error } = await supabase
            .from('scenes')
            .update(updates)
            .eq('id', id)
            .select(SCENE_FIELDS)

        if (error) {
            console.error('[scenes PATCH] update failed:', error.code, error.message)
            const schemaBehind = error.code === '42703' || /column .* does not exist/i.test(error.message || '')
            return NextResponse.json(
                {
                    error: schemaBehind
                        ? 'The database is missing a column this build expects. Run the pending migration.'
                        : 'Could not save the scene.',
                    detail: process.env.NODE_ENV === 'production' ? undefined : error.message,
                },
                { status: 500 }
            )
        }

        if (!rows?.length) {
            console.error(
                '[scenes PATCH] update affected 0 rows for scene', id,
                '— the row exists and is owned by this user, so an UPDATE row-level ' +
                'security policy on public.scenes is rejecting the write.'
            )
            return NextResponse.json(
                { error: 'The scene could not be updated. Check the update policy on the scenes table.' },
                { status: 403 }
            )
        }

        return NextResponse.json({ scene: rows[0] })
    } catch (err) {
        console.error('[scenes PATCH] unexpected error:', err)
        return NextResponse.json({ error: err.message || 'Unexpected error.' }, { status: 500 })
    }
}

// DELETE — remove a scene and its stored panorama.
export async function DELETE(_req, { params }) {
    try {
        const supabase = await createClient()
        const { data: { user }, error: authErr } = await supabase.auth.getUser()
        if (authErr || !user) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })

        const { id } = await params

        const { data: scene } = await supabase
            .from('scenes')
            .select('id, storage_path, projects!inner(user_id)')
            .eq('id', id)
            .eq('projects.user_id', user.id)
            .maybeSingle()

        if (!scene) return NextResponse.json({ error: 'Scene not found.' }, { status: 404 })

        // Storage removal is best-effort — never block the row delete on it.
        if (scene.storage_path) {
            try { await supabase.storage.from('scenes').remove([scene.storage_path]) }
            catch (e) { console.error('[scenes DELETE] storage removal failed:', e?.message) }
        }

        const { error } = await supabase.from('scenes').delete().eq('id', id)
        if (error) return NextResponse.json({ error: error.message }, { status: 500 })
        return NextResponse.json({ success: true })
    } catch (err) {
        return NextResponse.json({ error: err.message || 'Unexpected error.' }, { status: 500 })
    }
}