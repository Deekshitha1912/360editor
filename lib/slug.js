// lib/slug.js
// Turns a project name into the URL segment used by the public tour route.
// A slug is assigned on FIRST publish and then frozen — renaming a project
// must never break a link that has already been sent to a client.

export function slugify(name) {
    const s = String(name || '')
        .normalize('NFKD')
        .replace(/[\u0300-\u036f]/g, '')   // strip accents
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')       // everything else becomes a dash
        .replace(/^-+|-+$/g, '')           // trim dashes
        .slice(0, 60)
        .replace(/-+$/g, '')
    return s || 'tour'
}

/**
 * Returns a slug that is free for this user.
 * Appends -2, -3 … when the base slug is already taken by another project.
 *
 * @param supabase  session-bound client (RLS scopes reads to this user)
 * @param userId    owner
 * @param name      project name
 * @param excludeId project being published (its own slug isn't a conflict)
 */
export async function uniqueSlug(supabase, userId, name, excludeId) {
    const base = slugify(name)

    const { data } = await supabase
        .from('projects')
        .select('id, slug')
        .eq('user_id', userId)
        .not('slug', 'is', null)

    const taken = new Set(
        (data ?? []).filter(p => p.id !== excludeId).map(p => p.slug)
    )

    if (!taken.has(base)) return base
    for (let n = 2; n < 1000; n++) {
        const candidate = `${base}-${n}`
        if (!taken.has(candidate)) return candidate
    }
    return `${base}-${Date.now()}`
}