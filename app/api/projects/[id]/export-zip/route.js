// app/api/projects/[id]/export-zip/route.js
//
// POST → a self-contained .zip download of the CURRENT (not necessarily
// published) tour: index.html + every image it references, fetched here and
// re-saved under /assets with the HTML rewritten to point at them instead of
// their original Supabase storage URLs. The result can be uploaded as-is to
// any static host (Nginx, S3, Netlify, GitHub Pages...) with zero dependency
// on this app or its storage staying online — the ONE remaining external
// dependency is the Photo Sphere Viewer/three.js libraries, still loaded
// from the public jsdelivr CDN at runtime, same as the hosted tour does.
//
// Reads live from scenes/hotspots/polygons (like PATCH/PUT elsewhere), not
// projects.published_payload — this is "download what I'm looking at right
// now", not "download what's live at the public link".
//
// Spends ONE credit per download (POST, not GET, since it now has a real
// side effect) — once someone has this zip, nothing technical stops them
// re-hosting it verbatim or hand-editing its embedded data to reuse it as a
// different tour, entirely outside this app. Charging per download at least
// means each portable copy someone walks away with actually cost something,
// same reasoning as project creation and the publish-cycle renewal.

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import JSZip from 'jszip'
import { consumeCredit, refundCredit } from '@/lib/credits'
import { buildTourHtml } from '@/components/360editor/project/export'
import { ARROWS } from '@/lib/arrows'
import { projectLogos, projectCoverups } from '@/lib/overlays'

const PROJECT_FIELDS = 'id, name, show_intro, auto_rotate, hotspot_size, overlays, coverups'

function isHttpUrl(u) {
    return typeof u === 'string' && /^https?:\/\//i.test(u)
}

// Every image this specific tour actually references — panoramas, arrow
// glyphs (only the few real sprite files; landmark/floor/pulse/circle/custom's
// placeholder are inline data: URIs already, nothing to fetch), custom
// hotspot icons, overlay logos/cover-ups, and any image fields inside an
// info card (hotspot OR zone, both share the same info_fields shape).
function collectMediaUrls({ scenes, hotspots, polygons, logos, coverups }) {
    const urls = new Set()
    const add = u => { if (isHttpUrl(u)) urls.add(u) }

    scenes.forEach(s => add(s.url))
    logos.forEach(l => add(l.url))
    coverups.forEach(c => add(c.url))

    hotspots.forEach(h => {
        const arrow = ARROWS.find(a => a.type === h.arrow_type) || ARROWS[0]
        add(arrow.gif)
        add(h.custom_icon_url)
        add(h.info_image_url)
        ;(h.info_fields || []).forEach(f => { if (f?.type === 'image') add(f.value) })
    })

    polygons.forEach(p => {
        add(p.info_image_url)
        ;(p.info_fields || []).forEach(f => { if (f?.type === 'image') add(f.value) })
    })

    return [...urls]
}

const EXT_BY_MIME = {
    'image/jpeg': '.jpg', 'image/png': '.png', 'image/gif': '.gif',
    'image/webp': '.webp', 'image/svg+xml': '.svg', 'image/avif': '.avif',
}

function guessExt(url, contentType) {
    const m = /\.([a-z0-9]{2,5})(?:\?|#|$)/i.exec(url)
    if (m) return '.' + m[1].toLowerCase()
    return EXT_BY_MIME[contentType] || '.bin'
}

// Fetched one at a time (not Promise.all) — a tour can reference dozens of
// full-size panoramas; unbounded concurrency here would just as easily hit
// this server's own outbound connection/memory limits as it would speed
// anything up. A single broken/unreachable image is skipped (rewritten
// nowhere, so the zip's HTML keeps that one field pointing at its original
// URL) rather than failing the whole export over one bad asset.
async function fetchAssets(urls) {
    const map = new Map()
    let i = 0
    for (const url of urls) {
        i += 1
        try {
            const res = await fetch(url)
            if (!res.ok) continue
            const buf = Buffer.from(await res.arrayBuffer())
            const name = `assets/img-${String(i).padStart(4, '0')}${guessExt(url, res.headers.get('content-type'))}`
            map.set(url, { name, buf })
        } catch {
            // Unreachable/CORS-blocked/deleted — leave this one URL as-is.
        }
    }
    return map
}

// Light obfuscation of the zip's own copy ONLY — the hosted tour and the
// Preview iframe (both built from the exact same buildTourHtml()) stay
// completely untouched, since this runs as a post-processing pass on the
// already-built html string here, not inside export.jsx itself.
//
// Real DRM on a file someone fully owns and controls doesn't exist — a
// motivated developer defeats this in minutes with devtools. The actual
// goal is raising the bar past "open index.html in Notepad, find the
// panorama filename, replace it" for a non-technical reuser, by making the
// scene/hotspot data (TOURS) and scene list (SM) opaque base64 instead of
// plain readable JSON sitting right in the file.
//
// String-split on exact literals rather than a regex — safe even if some
// hotspot label/body text happens to contain stray semicolons, since the
// only thing that would break this is that text containing the exact
// contiguous substring ";var SM=", which is not a realistic risk.
const TOURS_PREFIX = 'var TOURS='
const TOURS_INFIX  = ';var SM='
const TOURS_SUFFIX = ';\n'

function obfuscateTourData(html) {
    const start = html.indexOf(TOURS_PREFIX)
    if (start === -1) return html
    const infixAt = html.indexOf(TOURS_INFIX, start + TOURS_PREFIX.length)
    if (infixAt === -1) return html
    const suffixAt = html.indexOf(TOURS_SUFFIX, infixAt + TOURS_INFIX.length)
    if (suffixAt === -1) return html

    const toursJson = html.slice(start + TOURS_PREFIX.length, infixAt)
    const smJson    = html.slice(infixAt + TOURS_INFIX.length, suffixAt)

    // Buffer's base64 encoding is UTF-8-correct (a scene/hotspot name in any
    // language round-trips fine); atob() alone is NOT (it's Latin1-only), so
    // the browser-side decoder needs the classic escape/decodeURIComponent
    // reinterpretation to match, not a bare atob().
    const toursB64 = Buffer.from(toursJson, 'utf8').toString('base64')
    const smB64    = Buffer.from(smJson, 'utf8').toString('base64')

    const replacement =
        'function _ub64(b){return decodeURIComponent(Array.prototype.map.call(atob(b),' +
        'function(c){return "%"+("00"+c.charCodeAt(0).toString(16)).slice(-2);}).join(""));}' +
        'var TOURS=JSON.parse(_ub64("' + toursB64 + '"));var SM=JSON.parse(_ub64("' + smB64 + '"));\n'

    return html.slice(0, start) + replacement + html.slice(suffixAt + TOURS_SUFFIX.length)
}

function slugifyFilename(name) {
    const s = (name || 'tour').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
    return s || 'tour'
}

export async function POST(_req, { params }) {
    try {
        const supabase = await createClient()
        const { data: { user }, error: authErr } = await supabase.auth.getUser()
        if (authErr || !user) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })

        const { id } = await params

        const { data: project } = await supabase
            .from('projects').select(PROJECT_FIELDS).eq('id', id).eq('user_id', user.id).single()
        if (!project) return NextResponse.json({ error: 'Project not found.' }, { status: 404 })

        const [{ data: scenes }, { data: hotspots }, polygonsRes] = await Promise.all([
            supabase
                .from('scenes')
                .select('id, project_id, name, url, initial_yaw, initial_pitch, initial_hfov, created_at')
                .eq('project_id', id)
                .order('created_at'),
            supabase
                .from('hotspots')
                .select('id, scene_id, project_id, pitch, yaw, arrow_type, label, target_scene_id, size, rotation, color, label_color, rotate_x, rotate_y, action_type, link_url, info_body, info_image_url, info_fields, toggle_target_id, start_hidden, animate_line, custom_icon_url')
                .eq('project_id', id),
            supabase
                .from('polygons')
                .select('id, scene_id, project_id, points, status, label, detail, custom_color, edge_lengths, action_type, target_scene_id, link_url, info_body, info_image_url, info_fields, toggle_target_id, start_hidden')
                .eq('project_id', id),
        ])
        const polygons = polygonsRes.error ? [] : (polygonsRes.data ?? [])

        if (!scenes?.length)
            return NextResponse.json({ error: 'Add at least one scene before exporting.' }, { status: 400 })

        // Charged AFTER the free "is there anything to export" check above
        // (no reason to spend a credit on a request that was always going to
        // 400), but BEFORE the actual work below — a failure past this point
        // refunds it rather than silently keeping it.
        const creditOk = await consumeCredit(user.id)
        if (!creditOk) {
            return NextResponse.json(
                { error: 'You have no credits left. Buy more to download a self-hostable zip.' },
                { status: 402 }
            )
        }

        try {
            const logos = projectLogos(project)
            const coverups = projectCoverups(project)

            const mediaUrls = collectMediaUrls({ scenes, hotspots: hotspots ?? [], polygons, logos, coverups })
            const assetMap = await fetchAssets(mediaUrls)

            let html = buildTourHtml({ project, scenes, hotspots: hotspots ?? [], polygons })

            // Longest URL first — a shorter storage URL is never actually a
            // substring of an unrelated longer one in practice (each embeds a
            // unique object path), but sorting this way costs nothing and rules
            // it out on principle rather than relying on that being true.
            const entries = [...assetMap.entries()].sort((a, b) => b[0].length - a[0].length)
            for (const [origUrl, asset] of entries) {
                html = html.split(origUrl).join(asset.name)
            }

            // Obfuscate AFTER the URL rewrite above, not before — it has to
            // see the final local /assets paths in plain text to find and
            // replace them; encoding TOURS first would hide those paths from
            // the split/join rewrite entirely.
            html = obfuscateTourData(html)

            const zip = new JSZip()
            zip.file('index.html', html)
            for (const asset of assetMap.values()) zip.file(asset.name, asset.buf)
            zip.file('README.txt',
                `${project.name} — self-hosted 360° tour\r\n\r\n` +
                `Upload every file in this zip, keeping the folder structure, to any static\r\n` +
                `web host (Nginx, Apache, S3/CloudFront, Netlify, GitHub Pages, ...) and open\r\n` +
                `index.html. Every image is bundled locally under /assets -- the only\r\n` +
                `remaining outside dependency is the Photo Sphere Viewer/three.js libraries,\r\n` +
                `still loaded from the public jsdelivr CDN at runtime, same as this tour's\r\n` +
                `hosted link does.\r\n`
            )

            const buffer = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' })

            return new NextResponse(buffer, {
                status: 200,
                headers: {
                    'Content-Type': 'application/zip',
                    'Content-Disposition': `attachment; filename="${slugifyFilename(project.name)}-tour.zip"`,
                    'Cache-Control': 'no-store',
                },
            })
        } catch (err) {
            await refundCredit(user.id)
            return NextResponse.json({ error: err?.message || 'Could not build the zip.' }, { status: 500 })
        }
    } catch (err) {
        return NextResponse.json({ error: err?.message || 'Unexpected error.' }, { status: 500 })
    }
}
