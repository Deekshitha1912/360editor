// app/api/projects/[id]/renew/route.js
//
// Spends RENEWAL_CREDIT_COST credits to reset a project's 1-year publishing
// window (publish_cycle_started_at) back to now — the only way past the
// block POST /api/projects/[id]/publish and the public tour route both
// apply once that window has run out. See lib/publish-cycle.js.
//
// Costs more than a normal 1-credit spend (project creation, a zip
// download) — renewing is closer in value to a second project than to a
// single action, so it's priced above them rather than at parity.

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { consumeCredit, refundCredit } from '@/lib/credits'

const RENEWAL_CREDIT_COST = 2

export async function POST(_req, { params }) {
    try {
        const supabase = await createClient()
        const { data: { user }, error: authErr } = await supabase.auth.getUser()
        if (authErr || !user) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })

        const { id } = await params

        const { data: project } = await supabase
            .from('projects')
            .select('id, publish_cycle_started_at')
            .eq('id', id)
            .eq('user_id', user.id)
            .single()
        if (!project) return NextResponse.json({ error: 'Project not found.' }, { status: 404 })

        // Nothing to renew before the first publish ever set the anchor —
        // that first publish itself is unrestricted (the project-creation
        // credit already covers its first year).
        if (!project.publish_cycle_started_at) {
            return NextResponse.json(
                { error: 'Publish this tour at least once before renewing it.' },
                { status: 400 }
            )
        }

        // consume_credit spends exactly one at a time (no quantity param),
        // so RENEWAL_CREDIT_COST credits means that many sequential calls —
        // each one is its own atomic, row-locked spend (see lib/credits.js),
        // and a failure partway through refunds only what was actually taken
        // rather than leaving the user short without having renewed anything.
        let spent = 0
        for (; spent < RENEWAL_CREDIT_COST; spent++) {
            const ok = await consumeCredit(user.id)
            if (!ok) {
                for (let i = 0; i < spent; i++) await refundCredit(user.id)
                return NextResponse.json(
                    { error: `You need ${RENEWAL_CREDIT_COST} credits to renew this tour. Buy more to continue.` },
                    { status: 402 }
                )
            }
        }

        const now = new Date().toISOString()
        const { data: updated, error } = await supabase
            .from('projects')
            .update({ publish_cycle_started_at: now })
            .eq('id', id)
            .eq('user_id', user.id)
            .select('publish_cycle_started_at')
            .single()

        if (error) {
            // Update failed after the credits were already spent — give them back.
            for (let i = 0; i < RENEWAL_CREDIT_COST; i++) await refundCredit(user.id)
            return NextResponse.json({ error: error.message }, { status: 500 })
        }

        return NextResponse.json({ publish_cycle_started_at: updated.publish_cycle_started_at })
    } catch (err) {
        return NextResponse.json({ error: err?.message || 'Unexpected error.' }, { status: 500 })
    }
}
