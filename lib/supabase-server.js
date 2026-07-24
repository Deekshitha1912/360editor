// lib/supabase-server.js
//
// Session-bound server client. Uses the PUBLISHABLE key, so Row Level Security
// is enforced and every query runs AS THE LOGGED-IN USER.
//
// This is the default client for all normal data routes and server components.
// For the few privileged operations that genuinely can't run as the user
// (creating the auth user at signup, issuing signed upload URLs, granting
// credits, serving a published tour), use createAdminClient from
// '@/lib/supabase-admin' — and only after authorizing the request here.
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

// `sb_publishable_...` is the current form; the legacy anon JWT is the fallback.
// Both are referenced statically so Next can inline them into the bundle.
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

export async function createClient() {
    const cookieStore = await cookies()

    return createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        publishableKey(),
        {
            cookies: {
                getAll() {
                    return cookieStore.getAll()
                },
                setAll(cookiesToSet) {
                    try {
                        cookiesToSet.forEach(({ name, value, options }) =>
                            cookieStore.set(name, value, options)
                        )
                    } catch {
                        // Read-only in Server Components — fine to ignore.
                    }
                },
            },
        }
    )
}