// lib/supabase-admin.js
import { createClient as createSupabaseClient } from '@supabase/supabase-js'

/**
 * SERVICE-ROLE client. Bypasses RLS. NEVER expose to the browser, never use it
 * as a convenience to skip ownership checks.
 *
 * Use ONLY for privileged operations that cannot run as the user:
 *   - inserting a profiles row during signup (no session exists yet)
 *   - issuing signed upload URLs for storage
 *
 * ALWAYS authorize the request with the session client (auth + ownership)
 * BEFORE calling anything on this client.
 */
export function createAdminClient() {
    return createSupabaseClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY,
        { auth: { persistSession: false, autoRefreshToken: false } }
    )
}