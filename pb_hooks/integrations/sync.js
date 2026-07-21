/// <reference path="../../pb_data/types.d.ts" />

/**
 * Full-catalogue pull orchestration (#487 Phase 2). Goja port of share-mvp `core/sync.ts`.
 * Runs entirely in the backend: native `$app`, per-institution transaction, shared `$app.store()`
 * overlap lock — no HTTP POST to the frontend, no superuser client, no batching/retry.
 *
 * `runSync()` is the cron entrypoint (see integration_sync.pb.js). The Create path in
 * `db.js applyDiff` (built in Phase 1 but never triggered by the refresh diff) fires here for the
 * first time, because a full pull produces items whose `externalId` is unknown to the DB.
 */

const { makeSummary, errorMessage, logIntegrationSummary } = require(`${__hooks}/integrations/types.js`)
const { diffItems } = require(`${__hooks}/integrations/diff.js`)
const { loadExistingItems, findSyncConfigs, applyDiff } = require(`${__hooks}/integrations/db.js`)
const { leihbackendPullIntegration } = require(`${__hooks}/integrations/leihbackend.js`)

/**
 * Archive-phase circuit-breaker rate. DISTINCT from the refresh breaker: the refresh aborts the
 * whole institution (zero writes) at ≥50% gone/error; the SYNC breaker only SKIPS THE ARCHIVE
 * PHASE (creates/updates still apply) when the feed is empty or would archive ≥50% of stored items.
 */
const SYNC_ARCHIVE_ABORT_RATE = 0.5

/**
 * Ordered full-pull registry. Only leihbackend has a practical bulk feed (WINBIAP has no bulk
 * catalogue and is refresh-only), so it's the sole entry. Structured like getRefreshIntegrations()
 * so a future bulk source is a one-line addition.
 */
function getPullIntegrations() {
    return [leihbackendPullIntegration]
}

/**
 * Returns an ops-facing error string (and the signal to skip archiving) when the feed looks like an
 * outage rather than a real catalogue shrink, or `null` when archiving is safe.
 */
function archiveGuardError(fetchedCount, toArchiveCount, existingCount) {
    if (existingCount === 0 || toArchiveCount === 0) return null
    if (fetchedCount === 0) {
        return (
            'Archive phase skipped: source returned 0 items while ' +
            existingCount +
            ' synced items exist (likely source outage) — nothing archived.'
        )
    }
    if (toArchiveCount / existingCount >= SYNC_ARCHIVE_ABORT_RATE) {
        return (
            'Archive phase skipped: ' +
            toArchiveCount +
            '/' +
            existingCount +
            ' synced items would be archived (≥' +
            SYNC_ARCHIVE_ABORT_RATE * 100 +
            '% — likely source outage). Creates/updates were applied. If the removal is intentional, ' +
            'archive the affected items manually.'
        )
    }
    return null
}

/**
 * Syncs a single institution: fetch+map the full source catalogue, diff against current DB state,
 * then apply batched-free creates/updates/archives in ONE transaction (all-or-nothing).
 *
 * Aborts with zero writes if `fetchAndMap` or the DB load throws. Skips ONLY the archive phase
 * (recording an error, creates/updates still applied) when `archiveGuardError` fires.
 *
 * @param {any} app - `$app`.
 * @param {object} institution - a `sync_config`-derived institution.
 * @param {(institution: object) => Array} fetchAndMap - integration's fetch+map callback.
 * @returns {object} a SyncSummary.
 */
function syncInstitution(app, institution, fetchAndMap) {
    const startTime = Date.now()
    const summary = makeSummary(institution.username)

    try {
        const mappedItems = fetchAndMap(institution)
        summary.fetched = mappedItems.length

        const existingItems = loadExistingItems(app, institution.id)

        const diff = diffItems(mappedItems, existingItems)
        summary.skipped = diff.skipped

        const guardError = archiveGuardError(mappedItems.length, diff.toArchive.length, existingItems.length)
        if (guardError) summary.errors.push(guardError)

        // Guard fired ⇒ drop the archive phase only; creates/updates still apply.
        const effectiveDiff = guardError
            ? { toCreate: diff.toCreate, toUpdate: diff.toUpdate, toArchive: [], skipped: diff.skipped }
            : diff

        // All-or-nothing per institution: any failed write throws and rolls the whole tx back.
        let writes = { created: 0, updated: 0, archived: 0 }
        app.runInTransaction((txApp) => {
            writes = applyDiff(txApp, effectiveDiff)
        })
        summary.created = writes.created
        summary.updated = writes.updated
        summary.archived = writes.archived
    } catch (err) {
        summary.errors.push(errorMessage(err))
    } finally {
        summary.durationMs = Date.now() - startTime
    }

    return summary
}

/**
 * Cron entrypoint: full-pulls every enabled pull-integration institution locally. Guarded by the
 * SAME `$app.store()` overlap lock as the refresh (`integrationRunLock`) — both write `items`, so
 * a sync and a refresh never run concurrently. `DRY_MODE` logs and skips all fetches + writes.
 *
 * @param {string} [institutionId] - optional: sync only this institution (else all).
 */
function runSync(institutionId) {
    const { DRY_MODE } = require(`${__hooks}/constants.js`)

    if (DRY_MODE) {
        $app.logger().info('[cron:sync] DRY_MODE — skipping upstream fetches and writes')
        return
    }

    // Atomic acquire, shared with refresh (see refresh.js for the TOCTOU rationale).
    const store = $app.store()
    const token = `sync:${Date.now()}:${Math.random()}`
    if (store.getOrSet('integrationRunLock', () => token) !== token) {
        $app.logger().warn('[cron:sync] previous run still active — skipping')
        return
    }

    try {
        const pulls = getPullIntegrations()
        let anyInstitution = false
        for (let p = 0; p < pulls.length; p++) {
            const integration = pulls[p]
            let institutions
            try {
                // Full sync is per pull-integration (only leihbackend has a bulk feed) — WINBIAP
                // never appears here, so the "WINBIAP picked up by the full sync" footgun is gone.
                institutions = findSyncConfigs($app, { integration: integration.id, institutionId: institutionId })
            } catch (err) {
                $app.logger().error('[cron:sync] institution discovery failed', 'integration', integration.id, 'error', errorMessage(err))
                continue
            }
            for (let i = 0; i < institutions.length; i++) {
                anyInstitution = true
                // Per-institution failures are isolated inside syncInstitution (summary.errors).
                logIntegrationSummary($app, '[cron:sync]', syncInstitution($app, institutions[i], integration.fetchAndMap))
            }
        }
        if (!anyInstitution) {
            $app.logger().info('[cron:sync] done — no institutions configured')
        }
    } finally {
        // Only the lock holder reaches here — release it (never leak the lock on an exception).
        store.remove('integrationRunLock')
    }
}

module.exports = { runSync, syncInstitution, getPullIntegrations, archiveGuardError, SYNC_ARCHIVE_ABORT_RATE }
