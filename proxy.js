import { NextResponse } from 'next/server'
import { createMiddlewareClient } from '@/lib/supabase-middleware'

const protectedRoutes = ['/360editor']
// '/' removed so logged-in users CAN view the public landing page.
// (/login and /signup still bounce logged-in users to the dashboard.)
const authRoutes      = ['/login', '/signup']

export async function proxy(request) {
    const { supabase, state } = createMiddlewareClient(request)
    const { data: { user } } = await supabase.auth.getUser()
    const { pathname } = request.nextUrl

    const isProtected = protectedRoutes.some(r => pathname === r || pathname.startsWith(`${r}/`))

    // Not logged in on a protected route → send to the landing page.
    if (!user && isProtected) return redirectKeepingCookies('/', request, state)

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