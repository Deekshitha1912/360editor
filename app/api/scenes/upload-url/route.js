// app/api/scenes/upload-url/route.js
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { createAdminClient } from '@/lib/supabase-admin'

const BUCKET     = 'scenes'
const MAX_BYTES  = 50 * 1024 * 1024   // 50 MB — equirectangular panoramas are large
const MAX_SCENES = 30                 // matches the "up to 30 panoramas" promise

// body: { projectId, filename, contentType, size }
// Authorizes the request as the user, enforces limits, then returns a signed
// upload URL. The browser uploads the (large) file DIRECTLY to that URL with a
// plain fetch PUT — no Supabase client needed on the client, and no serverless
// body-size limit in the way.
export async function POST(req) {
    try {
        const supabase = await createClient()
        const { data: { user }, error: authErr } = await supabase.auth.getUser()
        if (authErr || !user) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })

        const { projectId, filename, contentType, size } = await req.json()
        if (!projectId || !filename)
            return NextResponse.json({ error: 'Missing fields.' }, { status: 400 })
        if (!contentType || !contentType.startsWith('image/'))
            return NextResponse.json({ error: 'File must be an image.' }, { status: 400 })
        if (typeof size === 'number' && size > MAX_BYTES)
            return NextResponse.json({ error: 'Image must be 50 MB or smaller.' }, { status: 400 })

        // Ownership
        const { data: project } = await supabase
            .from('projects').select('id').eq('id', projectId).eq('user_id', user.id).single()
        if (!project) return NextResponse.json({ error: 'Project not found.' }, { status: 404 })

        // Per-project scene cap
        const { count } = await supabase
            .from('scenes').select('id', { count: 'exact', head: true }).eq('project_id', projectId)
        if ((count ?? 0) >= MAX_SCENES)
            return NextResponse.json({ error: `Limit of ${MAX_SCENES} scenes per project reached.` }, { status: 400 })

        // Server builds the path (never trust a client-supplied path)
        const ext  = (filename.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '')
        const path = `${projectId}/${Date.now()}.${ext || 'jpg'}`

        // Signed upload URL is a privileged storage op → admin client, AFTER auth above.
        const admin = createAdminClient()
        const { data, error } = await admin.storage.from(BUCKET).createSignedUploadUrl(path)
        if (error) return NextResponse.json({ error: error.message }, { status: 500 })

        // data.signedUrl is a full absolute URL containing the upload token.
        return NextResponse.json({ path: data.path, signedUrl: data.signedUrl })
    } catch (err) {
        return NextResponse.json({ error: err.message || 'Unexpected error.' }, { status: 500 })
    }
}