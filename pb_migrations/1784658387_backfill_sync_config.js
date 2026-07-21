/// <reference path="../pb_data/types.d.ts" />

/**
 * #487 Phase 2 — data migration: backfill `sync_config` rows from the legacy
 * `users.leihbackendUrl` discovery fields (runs after 1784658386_created_sync_config.js).
 *
 * Verified (Phase 2 §3.1 spike): a migration MAY `require()` a pb_hooks module (`__hooks` is
 * defined in the migration context), so the backfill logic lives once in
 * `pb_hooks/services/syncConfig.js` and is reused here — no inline mirror needed.
 *
 * NOTE: the test harness applies migrations against an EMPTY users table, so this copy loop is
 * exercised via the guarded test route (`POST /api/_test/backfill-sync-config`) + a pre-seeded
 * fixture, not by `npm test`'s migration apply. Idempotent, so re-running is safe.
 *
 * down(): removes every `sync_config` row (the collection itself is dropped by the create
 * migration's down); `users` is left untouched.
 */
migrate((app) => {
    const { backfillSyncConfigs } = require(`${__hooks}/services/syncConfig.js`)
    backfillSyncConfigs(app)
}, (app) => {
    const rows = app.findRecordsByFilter('sync_config', 'id != ""', '', 100000, 0)
    for (let i = 0; i < rows.length; i++) {
        app.delete(rows[i])
    }
})
