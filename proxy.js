import { NextResponse } from 'next/server'
import { createMiddlewareClient } from '@/lib/supabase-middleware'

const protectedRoutes = ['/360editor']
// '/' removed so logged-in users CAN view the public landing page.
// (/login and /signup still bounce logged-in users to the dashboard.)
const authRoutes      = ['/login', '/signup']

// Published tours live at /<user_id>/<project-slug> and must stay completely
// public — no session lookup, no redirect, no cookie work on that path.
const PUBLIC_TOUR = /^\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/[a-z0-9][a-z0-9-]*\/?$/i

export async function proxy(request) {
    const { pathname } = request.nextUrl

    if (PUBLIC_TOUR.test(pathname)) return NextResponse.next()

    const { supabase, state } = createMiddlewareClient(request)
    const { data: { user }, error } = await supabase.auth.getUser()

    // A login cookie whose refresh token no longer exists on the server
    // (expired, already used, or signed out elsewhere) can never succeed,
    // but nothing removed it — so Supabase retried and logged "Invalid
    // Refresh Token" on every request, indefinitely. Delete the dead auth
    // cookies here, from both the request (so this request's server code
    // sees a clean logged-out state) and the response (so the browser drops
    // them). The error is then logged once, by the request that cleans up.
    if (!user && isDeadSession(error)) state.response = clearAuthCookies(request, state.response)

    const isProtected = protectedRoutes.some(r => pathname === r || pathname.startsWith(`${r}/`))

    // Not logged in on a protected route → send to the landing page.
    if (!user && isProtected) return redirectKeepingCookies('/', request, state)

    // No credit check here. Credits are spent on actions, and each of those
    // checks for itself server-side: creating a tour (POST /api/projects —
    // the dashboard sends a 402 on to /pricing), downloading a zip, renewing.
    // Gating pages on the balance locked owners out of their own tours — the
    // dashboard included — the moment it hit zero, typically right after
    // spending their last credit on the tour they then couldn't open.

    // Already logged in on a login/signup route → send to the dashboard.
    if (user && authRoutes.includes(pathname)) return redirectKeepingCookies('/360editor', request, state)

    return state.response
}

// Errors that mean the stored session can never be recovered, as opposed to
// a transient failure (network, Supabase briefly down) where the cookie
// must be kept.
const DEAD_SESSION_CODES = new Set([
    'refresh_token_not_found', 'refresh_token_already_used', 'session_not_found', 'session_expired', 'bad_jwt', 'user_not_found',
])
function isDeadSession(error) {
    return !!error && (DEAD_SESSION_CODES.has(error.code) || /invalid refresh token/i.test(error.message || ''))
}

// Supabase stores the session as sb-<project-ref>-auth-token, split into
// .0/.1/... chunks when large, plus a PKCE code-verifier cookie.
// Returns a rebuilt response: NextResponse.next({ request }) captures the
// request's cookies when it's created, so it has to be made after the
// deletions for this request's pages to see them gone. Any cookies already
// set on the old response are carried over.
function clearAuthCookies(request, response) {
    const dead = request.cookies.getAll().map(c => c.name)
        .filter(name => /^sb-.+-auth-token(-code-verifier)?(\.\d+)?$/.test(name))
    if (!dead.length) return response
    dead.forEach(name => request.cookies.delete(name))
    const next = NextResponse.next({ request })
    response.cookies.getAll().forEach(c => { if (!dead.includes(c.name)) next.cookies.set(c) })
    dead.forEach(name => next.cookies.set(name, '', { path: '/', maxAge: 0 }))
    return next
}

function redirectKeepingCookies(path, request, state) {
    const redirect = NextResponse.redirect(new URL(path, request.url))
    state.response.cookies.getAll().forEach(c => redirect.cookies.set(c))
    return redirect
}

export const config = {
    matcher: ['/((?!api|_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt|.*\\..*).*)'],
}