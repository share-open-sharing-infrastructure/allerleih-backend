/// <reference path="../pb_data/types.d.ts" />

/**
 * #487 Phase 2 — guarded, test-only route to run the `sync_config` backfill on demand.
 * The data migration applies against an empty users table under the test harness, so the copy
 * loop can only be exercised end-to-end via this route against a pre-seeded fixture.
 *
 * Kept in its own file (not integration_sync.pb.js) so the cron-scheduling logic stays focused;
 * mirrors how retention keeps its own guarded test route with its domain (pattern:
 * RETENTION_TEST_ROUTE in retention.pb.js).
 *
 * Registered ONLY when INTEGRATION_TEST_ROUTE === 'true'; superuser required. Never in production.
 */
const { INTEGRATION_TEST_ROUTE } = require(`${__hooks}/constants.js`)

if (INTEGRATION_TEST_ROUTE) {
    routerAdd(
        'POST',
        '/api/_test/backfill-sync-config',
        (e) => {
            const { backfillSyncConfigs } = require(`${__hooks}/services/syncConfig.js`)
            return e.json(200, backfillSyncConfigs($app))
        },
        $apis.requireSuperuserAuth()
    )
}
