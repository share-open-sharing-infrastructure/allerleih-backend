/// <reference path="../../pb_data/types.d.ts" />

/**
 * Per-item refresh orchestration for the integration port (share-mvp#487 Phase 1).
 * Goja port of share-mvp `core/refresh.ts` + the refresh half of `registry.ts`. Runs entirely
 * in the backend: native `$app`, per-institution transaction, `$app.store()` overlap lock — no
 * HTTP POST to the frontend, no superuser client, no batching/retry.
 *
 * `runRefresh()` is the cron entrypoint (see integration_sync.pb.js).
 */

const { makeSummary, errorMessage } = require(`${__hooks}/integrations/types.js`)
const { diffItems } = require(`${__hooks}/integrations/diff.js`)
const { loadExistingItems, findSyncInstitutions, applyDiff } = require(`${__hooks}/integrations/db.js`)
const { winbiapRefreshIntegration } = require(`${__hooks}/integrations/winbiap.js`)
const { leihbackendRefreshIntegration } = require(`${__hooks}/integrations/leihbackend.js`)

/**
 * If at least this fraction of an institution's per-item fetches fail with a transient error
 * **or come back "gone"**, the whole institution is aborted with zero writes. Both signals
 * indicate a likely source outage: a renamed/removed source view 404s every record, and a
 * WebOPAC in maintenance can answer every barcode with an empty (but well-formed) result —
 * either would wrongly mass-archive the catalogue if trusted.
 */
const REFRESH_ABORT_RATE = 0.5

/**
 * Ordered refresh registry. More specific integrations come FIRST; leihbackend is the catch-all
 * (`claimsItem: () => true`) and stays LAST — otherwise it would grab, and wrongly archive,
 * WINBIAP items (which 404 against `item_public`). Order is security-relevant.
 */
function getRefreshIntegrations() {
    return [winbiapRefreshIntegration, leihbackendRefreshIntegration]
}

/**
 * Refreshes one institution's already-stored external items, one at a time: each item is routed
 * to the `RefreshIntegration` that claims it and re-fetched from its source.
 *  - `found` items are diffed against the stored record and updated if changed.
 *  - `gone` items are archived (via the normal diff archive path).
 *  - `error` items (transient failures) are left untouched and count toward the circuit-breaker.
 *
 * Aborts with zero writes if the DB load fails, or if the combined transient-error + gone rate
 * reaches `REFRESH_ABORT_RATE`. Writes run inside a single transaction (all-or-nothing).
 *
 * @param {any} app - `$app`.
 * @param {object} institution - the institution whose stored items are refreshed.
 * @param {Array} integrations - refresh integrations, tried in order via `claimsItem`.
 * @returns {object} a SyncSummary.
 */
function refreshInstitution(app, institution, integrations) {
    const startTime = Date.now()
    const summary = makeSummary(institution.username)

    try {
        const existingItems = loadExistingItems(app, institution.id)

        const fetched = []
        const resolved = [] // items with a definitive answer (found or gone)
        let goneCount = 0

        // Narrow to the integrations serving this institution's source before item routing, so a
        // catch-all claimsItem can't grab (and archive) another source's items.
        const candidates = integrations.filter((candidate) =>
            candidate.claimsInstitution ? candidate.claimsInstitution(institution) : true
        )

        for (let i = 0; i < existingItems.length; i++) {
            const item = existingItems[i]
            let integration = null
            for (let c = 0; c < candidates.length; c++) {
                if (candidates[c].claimsItem(item)) {
                    integration = candidates[c]
                    break
                }
            }
            if (!integration) continue // no integration owns this item — leave it untouched

            let outcome
            try {
                outcome = integration.fetchOne(institution, item)
            } catch (err) {
                outcome = { kind: 'error', message: errorMessage(err) }
            }

            if (outcome.kind === 'found') {
                fetched.push(outcome.item)
                resolved.push(item)
            } else if (outcome.kind === 'gone') {
                resolved.push(item)
                goneCount += 1
            } else {
                summary.errors.push(outcome.message)
            }

            // Pacing (spike §4.4 finding 2): the JSVM has a real blocking `sleep(ms)`, so WINBIAP's
            // per-item WebOPAC courtesy pause is preserved 1:1 (no HTTP-batching hack needed).
            if (integration.pauseMsBetweenFetches) sleep(integration.pauseMsBetweenFetches)
        }

        summary.fetched = fetched.length

        // Circuit-breaker: a likely outage — abort without archiving. "Gone" answers count too:
        // a collection-level 404 or an empty-but-well-formed source response reports every item as
        // gone, which must not be mistaken for a genuine mass-removal.
        const suspicious = summary.errors.length + goneCount
        if (existingItems.length > 0 && suspicious / existingItems.length >= REFRESH_ABORT_RATE) {
            summary.errors.unshift(
                'Aborted: ' +
                    suspicious +
                    '/' +
                    existingItems.length +
                    ' item fetches were suspicious (' +
                    summary.errors.length +
                    ' transient errors, ' +
                    goneCount +
                    ' reported gone) — likely source outage; nothing archived. If the removal is ' +
                    'intentional, archive the items manually.'
            )
            return summary
        }

        const diff = diffItems(fetched, resolved)
        summary.skipped = diff.skipped

        // All-or-nothing per institution: any failed write throws and rolls the whole tx back.
        let writes = { created: 0, updated: 0, archived: 0 }
        app.runInTransaction((txApp) => {
            writes = applyDiff(txApp, diff)
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

/** Logs one per-institution summary line — counts only, never item content or user PII. */
function logSummary(summary) {
    const line =
        '[cron:refresh] ' +
        summary.institution +
        ': fetched=' +
        summary.fetched +
        ' created=' +
        summary.created +
        ' updated=' +
        summary.updated +
        ' archived=' +
        summary.archived +
        ' skipped=' +
        summary.skipped +
        ' errors=' +
        summary.errors.length +
        ' (' +
        summary.durationMs +
        'ms)'
    if (summary.errors.length > 0) {
        $app.logger().error(line, 'errors', JSON.stringify(summary.errors))
    } else {
        $app.logger().info(line)
    }
}

/**
 * Cron entrypoint: refreshes every configured institution locally. Guarded by a
 * concurrency-safe overlap lock in `$app.store()` (shared with the future backend sync port,
 * both write `items`). `DRY_MODE` logs and skips all upstream fetches + writes.
 *
 * ⚠️ Interim lock caveat (until Phase 3): the still-frontend `/api/sync` uses a separate
 * process-level lock and cannot see this store lock — do not overlap the schedules or fire a
 * manual frontend sync during a backend refresh window (runbook).
 *
 * @param {string} [institutionId] - optional: refresh only this institution (else all).
 */
function runRefresh(institutionId) {
    const { DRY_MODE } = require(`${__hooks}/constants.js`)

    if (DRY_MODE) {
        $app.logger().info('[cron:refresh] DRY_MODE — skipping upstream fetches and writes')
        return
    }

    // Atomic acquire: getOrSet runs the setter ONLY when the key is absent, all under the store's
    // internal lock. This closes the TOCTOU window a separate get()+set() had — two back-to-back
    // triggers (a manual POST /api/crons racing a scheduled tick) can no longer both pass the
    // guard. The winner's token is stored; every loser reads it back (!== its own token) and skips.
    // (setFunc-with-throw would work too, but getOrSet avoids relying on a JS exception propagating
    // out of a Go callback.) Key shared with the future backend sync port — both write `items`.
    const store = $app.store()
    const token = `refresh:${Date.now()}:${Math.random()}`
    if (store.getOrSet('integrationRunLock', () => token) !== token) {
        $app.logger().warn('[cron:refresh] previous run still active — skipping')
        return
    }

    try {
        let institutions
        try {
            institutions = findSyncInstitutions($app, institutionId)
        } catch (err) {
            $app.logger().error('[cron:refresh] institution discovery failed', 'error', errorMessage(err))
            return
        }

        if (institutions.length === 0) {
            $app.logger().info('[cron:refresh] done — no institutions configured')
            return
        }

        const integrations = getRefreshIntegrations()
        for (let i = 0; i < institutions.length; i++) {
            // Per-institution failures are isolated inside refreshInstitution (summary.errors);
            // one bad institution never stops the others.
            logSummary(refreshInstitution($app, institutions[i], integrations))
        }
    } finally {
        // Only the lock holder reaches here — release it (never leak the lock on an exception).
        store.remove('integrationRunLock')
    }
}

module.exports = { runRefresh, refreshInstitution, getRefreshIntegrations, REFRESH_ABORT_RATE }
