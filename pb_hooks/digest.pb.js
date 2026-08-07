/// <reference path="../pb_data/types.d.ts" />

/**
 * Weekly Digest — sends "Dein Wochen-Rückblick" every Sunday at 12:00 noon.
 * Job logic lives in jobs/digest.js (see that file for the full section/opt-out/pacing docs);
 * this file only wires the cron schedule and the test-only trigger route.
 */

cronAdd('weekly_digest', '0 12 * * 0', () => {
    const { DRY_MODE } = require(`${__hooks}/constants.js`)

    if (DRY_MODE) {
        $app.logger().debug('[digest] Skipped — DRY_MODE is enabled')
        return
    }

    const { runWeeklyDigest } = require(`${__hooks}/jobs/digest.js`)
    try {
        const res = runWeeklyDigest($app)
        $app.logger().info(
            '[digest] cron run done',
            'sent', res.sent,
            'skippedOptOut', res.skippedOptOut,
            'failed', res.failed,
            'newItems', res.newItems
        )
    } catch (err) {
        $app.logger().error('[digest] cron run failed', 'error', String(err))
    }
})

// Test-only escape hatch: lets the integration tests trigger the digest over HTTP (cron
// schedules can't be fired on demand). Registered ONLY when DIGEST_TEST_ROUTE=true — the route
// does not exist in production. Mirrors RETENTION_TEST_ROUTE (retention.pb.js).
if ($os.getenv('DIGEST_TEST_ROUTE') === 'true') {
    routerAdd(
        'POST',
        '/api/_test/run-digest',
        (e) => {
            const { runWeeklyDigest } = require(`${__hooks}/jobs/digest.js`)
            return e.json(200, runWeeklyDigest($app))
        },
        $apis.requireSuperuserAuth()
    )
}
