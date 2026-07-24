// lib/supabase-middleware.js
//
// The proxy/middleware counterpart to lib/supabase-server.
//
// Same publishable key, same RLS — but the proxy runs on the edge and CANNOT use
// `cookies()` from next/headers. It reads cookies from the request and writes
// refreshed ones onto the response instead.
//
// Returns { supabase, state }. After calling supabase.auth.getUser(), read the
// final response from state.response (setAll may have rebuilt it to carry a
// refreshed token).
import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'

function publishableKey() {
    const key =
        process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

    if (!key) {
        throw new Error(
            'Supabase publishable key missing. Set NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY to the ' +
            'sb_publishable_... value from Dashboard → Settings → API Keys.'
        )
    }
    return key
}

export function createMiddlewareClient(request) {
    const state = { response: NextResponse.next({ request }) }

    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        publishableKey(),
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