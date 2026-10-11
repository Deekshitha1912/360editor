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
    const { data: { user } } = await supabase.auth.getUser()

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

function redirectKeepingCookies(path, request, state) {
    const redirect = NextResponse.redirect(new URL(path, request.url))
    state.response.cookies.getAll().forEach(c => redirect.cookies.set(c))
    return redirect
}

export const config = {
    matcher: ['/((?!api|_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt|.*\\..*).*)'],
}