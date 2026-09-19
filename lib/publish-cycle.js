// lib/publish-cycle.js
//
// One credit = a 1-year publishing window per project, not unlimited hosting
// forever (see db/014_add_publish_cycle.sql). Pure/no side effects — safe to
// import from both server routes and client components (the dashboard card
// badge, the editor's hosting-status banner).

export const PUBLISH_CYCLE_DAYS = 365
const CYCLE_MS = PUBLISH_CYCLE_DAYS * 24 * 60 * 60 * 1000

// null = never published yet — nothing to expire, publishing is unrestricted
// until the FIRST publish sets the anchor.
export function isPublishCycleExpired(publishCycleStartedAt) {
    const endsAt = publishCycleEndsAt(publishCycleStartedAt)
    return endsAt != null && Date.now() > endsAt.getTime()
}

export function publishCycleEndsAt(publishCycleStartedAt) {
    if (!publishCycleStartedAt) return null
    const started = new Date(publishCycleStartedAt)
    if (Number.isNaN(started.getTime())) return null
    return new Date(started.getTime() + CYCLE_MS)
}
