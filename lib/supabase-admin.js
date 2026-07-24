// lib/supabase-admin.js
//
// SERVICE-ROLE client. Bypasses RLS. NEVER expose to the browser, never use it
// as a convenience to skip ownership checks.
//
// Use ONLY for privileged operations that cannot run as the user:
//   - creating the auth user during signup (no session exists yet)
//   - issuing signed upload URLs for storage
//   - granting credits after a verified payment
//   - serving a published tour to an anonymous visitor
//
// ALWAYS authorize the request with the session client (auth + ownership)
// BEFORE calling anything on this client.
//
// ── KEY FORMAT ───────────────────────────────────────────────────────────────
// Supabase replaced the JWT-based `service_role` key with an opaque secret key
// (`sb_secret_...`). The legacy key was a JWT with no `kid` header; once a
// project rotates to asymmetric ES256 signing keys and the legacy keys are
// disabled, presenting it fails with:
//
//   invalid JWT: unable to parse or verify signature, token is unverifiable:
//   error while executing keyfunc: unrecognized JWT kid <nil> for algorithm ES256
//
// The fix is the key, not the code: Dashboard → Settings → API Keys → Secret
// keys → copy `sb_secret_...` into SUPABASE_SECRET_KEY.
// ─────────────────────────────────────────────────────────────────────────────
import { createClient as createSupabaseClient } from '@supabase/supabase-js'

let warned = false

function resolveSecretKey() {
    // Preferred name first, legacy second, so an existing deployment keeps
    // working the moment the value is swapped — even before the var is renamed.
    const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!key) {
        throw new Error(
            'Supabase secret key missing. Set SUPABASE_SECRET_KEY to the sb_secret_... value ' +
            'from Dashboard → Settings → API Keys (locally in .env.local, and in the Vercel ' +
            'project environment variables).'
        )
    }

    // A legacy JWT-based service_role key starts with "eyJ". It still works on
    // projects that have not disabled legacy keys, so this is a warning, not an
    // error — but it is the single likeliest cause of an ES256 / kid failure.
    if (!warned && key.startsWith('eyJ')) {
        warned = true
        console.warn(
            '[supabase-admin] Using a legacy JWT service_role key. If auth calls fail with ' +
            '"unrecognized JWT kid <nil> for algorithm ES256", replace it with the sb_secret_... ' +
            'key from Dashboard → Settings → API Keys.'
        )
    }

    return key
}

export function createAdminClient() {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    if (!url) throw new Error('NEXT_PUBLIC_SUPABASE_URL is not set.')

    return createSupabaseClient(url, resolveSecretKey(), {
        auth: { persistSession: false, autoRefreshToken: false },
    })
}