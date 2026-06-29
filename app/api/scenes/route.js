// app/api/scenes/route.js
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'

const BUCKET = 'scenes'

// body: { projectId, name, storage_path }
// Called after the browser has uploaded the file to the signed URL.
export async function POST(req) {
    try {
        const supabase = await createClient()
        const { data: { user }, error: authErr } = await supabase.auth.getUser()
        if (authErr || !user) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })

        const { projectId, name, storage_path } = await req.json()
        if (!projectId || !name?.trim() || !storage_path)
            return NextResponse.json({ error: 'Missing fields.' }, { status: 400 })

        // Ownership
        const { data: project } = await supabase
            .from('projects').select('id').eq('id', projectId).eq('user_id', user.id).single()
        if (!project) return NextResponse.json({ error: 'Project not found.' }, { status: 404 })

        // The path must live under this project's folder.
        if (!storage_path.startsWith(`${projectId}/`))
            return NextResponse.json({ error: 'Invalid storage path.' }, { status: 400 })

        const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(storage_path)

        const { data: scene, error } = await supabase
            .from('scenes')
            .insert({ project_id: projectId, name: name.trim(), storage_path, url: pub.publicUrl })
            .select().single()

        if (error) return NextResponse.json({ error: error.message }, { status: 500 })
        return NextResponse.json({ scene }, { status: 201 })
    } catch (err) {
        return NextResponse.json({ error: err.message || 'Unexpected error.' }, { status: 500 })
    }
}