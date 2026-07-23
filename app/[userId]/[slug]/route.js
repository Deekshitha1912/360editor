// app/[userId]/[slug]/route.js
//
// THE PUBLIC TOUR URL:  https://360editor.vercel.app/<user_id>/<project-slug>
//
// This is a Route Handler, not a page — it returns the tour HTML verbatim, so
// the served document is byte-for-byte what the old "Export HTML" download
// produced. No React shell, no layout.js, no hydration, no Tailwind bundle.
//
// It reads the frozen snapshot written by POST /api/projects/[id]/publish.
// Nothing here is user-session aware: the link works for anyone, logged in or
// not, and can be embedded in an <iframe> on a developer's own site (no
// X-Frame-Options header is set, on purpose).

import { createAdminClient } from '@/lib/supabase-admin'
import { buildTourHtml } from '@/components/360editor/project/export'

export const dynamic = 'force-dynamic'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const SLUG_RE = /^[a-z0-9][a-z0-9-]{0,79}$/

function notFound() {
    return new Response(
        `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"/>` +
        `<meta name="viewport" content="width=device-width,initial-scale=1"/>` +
        `<title>Tour not found</title><style>` +
        `html,body{height:100%;margin:0;display:flex;align-items:center;justify-content:center;` +
        `background:#0a0a0a;color:#fff;font:500 15px/1.6 -apple-system,Segoe UI,sans-serif;text-align:center}` +
        `p{opacity:.55;font-size:13px;margin:6px 0 0}</style></head><body><div>` +
        `<div style="font-size:19px;font-weight:600">This tour isn't available</div>` +
        `<p>The link may be wrong, or the tour has been unpublished.</p>` +
        `</div></body></html>`,
        { status: 404, headers: { 'content-type': 'text/html; charset=utf-8' } }
    )
}

export async function GET(_req, { params }) {
    try {
        const { userId, slug } = await params

        // Cheap rejects — keeps stray paths from ever touching the database.
        if (!UUID_RE.test(userId) || !SLUG_RE.test(slug)) return notFound()

        // Service role: the projects table has no public read policy, and this
        // query returns ONLY the published snapshot — never an unpublished row.
        const admin = createAdminClient()
        const { data, error } = await admin
            .from('projects')
            .select('published_payload')
            .eq('user_id', userId)
            .eq('slug', slug)
            .not('published_payload', 'is', null)
            .maybeSingle()

        if (error || !data?.published_payload) return notFound()

        const { project, scenes, hotspots } = data.published_payload
        if (!project || !scenes?.length) return notFound()

        const html = buildTourHtml({ project, scenes, hotspots: hotspots ?? [] })

        return new Response(html, {
            status: 200,
            headers: {
                'content-type': 'text/html; charset=utf-8',
                // Always fresh, so a re-publish is live the instant it finishes.
                // The heavy assets (panoramas, arrow sprites) already come from
                // Supabase's CDN, so this document is a few tens of KB.
                // If a tour ever gets real traffic, swap in:
                //   'public, max-age=0, s-maxage=60, stale-while-revalidate=300'
                'cache-control': 'no-store',
            },
        })
    } catch {
        return notFound()
    }
}