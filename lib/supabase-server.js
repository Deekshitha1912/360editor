// lib/supabase-server.js
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

/**
 * Session-bound server client. Uses the PUBLISHABLE (anon) key, so Row Level
 * Security is enforced and every query runs AS THE LOGGED-IN USER.
 *
 * This is the default client for all normal data routes and server components.
 * For the few privileged operations that genuinely can't run as the user
 * (profile insert at signup, issuing signed upload URLs), use createAdminClient
 * from '@/lib/supabase-admin' — and only after authorizing the request here.
 */
export async function createClient() {
    const cookieStore = await cookies()

    return createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
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