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

    // Logged in → must have at least one available credit, but ONLY to reach
    // the dashboard itself (where "New tour" lives), never to open/edit a
    // project already created. A tour is paid for once, at creation (see
    // POST /api/projects's own consumeCredit call) or via whichever
    // credit-gated action touches it later (export-zip, renew — both check
    // for themselves server-side); running out of credits afterward must
    // never lock the owner out of editing a tour they already own. This used
    // to gate every /360editor/* route, including /360editor/project/[id],
    // which is exactly what made an existing project become unreachable the
    // moment its owner's balance hit zero.
    // (RLS lets a user read only their own credits row, so this session client
    // is enough — no service role needed here.)
    if (user && pathname === '/360editor') {
        const { data: credit } = await supabase
            .from('credits')
            .select('available_credits')
            .eq('user_id', user.id)
            .maybeSingle()

        const available = credit?.available_credits ?? 0
        if (available < 1) {
            // No credits → bounce to the pricing page to buy.
            return redirectKeepingCookies('/pricing', request, state)
        }
    }

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