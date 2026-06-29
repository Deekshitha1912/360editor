// lib/supabase-middleware.js
import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'

/**
 * The proxy/middleware counterpart to lib/supabase-server.
 *
 * Same publishable key, same RLS — but the proxy runs on the edge and CANNOT use
 * `cookies()` from next/headers. It reads cookies from the request and writes
 * refreshed ones onto the response instead.
 *
 * Returns { supabase, state }. After calling supabase.auth.getUser(), read the
 * final response from state.response (setAll may have rebuilt it to carry a
 * refreshed token).
 */
export function createMiddlewareClient(request) {
    const state = { response: NextResponse.next({ request }) }

    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
        {
            cookies: {
                getAll: () => request.cookies.getAll(),
                setAll: (cookiesToSet) => {
                    cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
                    state.response = NextResponse.next({ request })
                    cookiesToSet.forEach(({ name, value, options }) =>
                        state.response.cookies.set(name, value, options)
                    )
                },
            },
        }
    )

    return { supabase, state }
}