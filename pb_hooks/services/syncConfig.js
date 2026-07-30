/// <reference path="../../pb_data/types.d.ts" />

/**
 * sync_config service (#487 Phase 2 §3) — backfills the new `sync_config` collection from the
 * legacy `users.leihbackendUrl`/`leihbackendItemUrlTemplate` discovery fields.
 *
 * Callable with a migration `app` OR a hook `$app` (verified: a migration may `require()` a
 * pb_hooks module). Idempotent: safe to run from the data migration AND re-run via the guarded
 * test route. Logs COUNTS ONLY — never a URL, username, or other institution detail.
 */

/**
 * Creates one `sync_config` row per configured institution that doesn't already have one for its
 * detected integration. Existing rows are left untouched (idempotent).
 *
 * Backfill rules (Phase 2 §3.2):
 *  - source: `users` with `isInstitution = true && leihbackendUrl != ""`
 *  - integration: `/webopac` in the URL → `winbiap`, else `leihbackend` (shared `isWinbiapUrl`)
 *  - mapping: institution=user.id, baseUrl=leihbackendUrl, itemUrlTemplate=leihbackendItemUrlTemplate,
 *    enabled=true (these institutions were already syncing)
 *  - idempotency key: (institution, integration)
 *
 * @param {any} app - a migration `app` or the hook `$app`.
 * @returns {{scanned: number, created: number, skipped: number, errors: number}}
 */
function backfillSyncConfigs(app) {
    // Lazy require (works in both migration and hook contexts); keeps the module's load-time
    // coupling minimal. Canonical source-type sniff — do not re-implement.
    const { isWinbiapUrl } = require(`${__hooks}/integrations/winbiap.js`)

    const collection = app.findCollectionByNameOrId('sync_config')
    const counts = { scanned: 0, created: 0, skipped: 0, errors: 0 }

    const PAGE = 200
    let offset = 0
    for (;;) {
        // Constant filter, no user-supplied values — nothing to bind.
        const batch = app.findRecordsByFilter(
            'users',
            'isInstitution = true && leihbackendUrl != ""',
            '',
            PAGE,
            offset
        )
        for (let i = 0; i < batch.length; i++) {
            const user = batch[i]
            counts.scanned += 1
            try {
                const url = user.getString('leihbackendUrl')
                const integration = isWinbiapUrl(url) ? 'winbiap' : 'leihbackend'

                // Idempotency: skip if a row for (institution, integration) already exists.
                const existing = app.findRecordsByFilter(
                    'sync_config',
                    'institution = {:institution} && integration = {:integration}',
                    '',
                    1,
                    0,
                    { institution: user.id, integration: integration }
                )
                if (existing.length > 0) {
                    counts.skipped += 1
                    continue
                }

                const record = new Record(collection)
                record.set('institution', user.id)
                record.set('integration', integration)
                record.set('baseUrl', url)
                record.set('itemUrlTemplate', user.getString('leihbackendItemUrlTemplate'))
                record.set('enabled', true)
                app.save(record)
                counts.created += 1
            } catch (err) {
                // Isolate per-row failures; never log institution details (counts-only convention).
                counts.errors += 1
                app.logger().warn('[backfill:sync_config] row failed', 'error', String(err))
            }
        }
        if (batch.length < PAGE) break
        offset += PAGE
    }

    app.logger().info(
        '[backfill:sync_config] done',
        'scanned', counts.scanned,
        'created', counts.created,
        'skipped', counts.skipped,
        'errors', counts.errors
    )
    return counts
}

module.exports = { backfillSyncConfigs }
