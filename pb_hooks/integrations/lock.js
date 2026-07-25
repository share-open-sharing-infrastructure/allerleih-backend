/// <reference path="../../pb_data/types.d.ts" />

/**
 * Overlap lock shared by EVERY integration code path that writes `items` (share-mvp#487):
 * the full-sync cron, the per-item refresh cron and — as of Phase 3 — the user-triggered
 * CSV-import apply/refresh routes. They all touch the same rows, so exactly one may run at a
 * time; without that, a cron sync computing its diff while an import writes would archive
 * freshly created items (and two concurrent applies would create duplicates, since `items`
 * has no unique index on `externalId`).
 *
 * Atomic acquire: `getOrSet` runs the setter ONLY when the key is absent, all under the store's
 * internal lock. That closes the TOCTOU window a separate get()+set() had — two back-to-back
 * triggers (a manual `POST /api/crons` racing a scheduled tick) can no longer both pass the
 * guard. The winner's token is stored; every loser reads it back (!== its own token) and gives up.
 * (setFunc-with-throw would work too, but `getOrSet` avoids relying on a JS exception propagating
 * out of a Go callback.)
 *
 * The lock lives in `$app.store()`, i.e. in memory: it is process-local (fine — all writers run
 * in this process) and a restart clears it, so a crash can never leave it stuck.
 */

const LOCK_KEY = 'integrationRunLock'

/**
 * Tries to acquire the shared integration lock.
 *
 * @param {any} app - `$app`.
 * @param {string} label - who is acquiring (`'sync'`, `'refresh'`, `'import'`) — token prefix only.
 * @returns {string|null} the caller's token when acquired, `null` when another run holds it.
 */
function acquireRunLock(app, label) {
    const token = label + ':' + Date.now() + ':' + Math.random()
    if (app.store().getOrSet(LOCK_KEY, () => token) !== token) return null
    return token
}

/** Releases the lock. Call ONLY from the holder, in a `finally` (never leak it on an exception). */
function releaseRunLock(app) {
    app.store().remove(LOCK_KEY)
}

module.exports = { LOCK_KEY, acquireRunLock, releaseRunLock }
