/// <reference path="../pb_data/types.d.ts" />

// Business-metrics project: nightly snapshot into `metrics_daily`, read by the
// share-mvp `/admin/metrics` and `/misc/stats` pages. Runs after the retention jobs
// (02:00-02:40) so a night that also anonymizes/purges records is reflected in the
// same day's snapshot. Job logic lives in jobs/metrics.js; it is read-only except for
// the single upserted `metrics_daily` row, and logs group names only — never values.
cronAdd('metricsDailySnapshot', '0 3 * * *', () => {
    const { runDailyMetricsSnapshot } = require(`${__hooks}/jobs/metrics.js`)
    try {
        const res = runDailyMetricsSnapshot($app)
        $app.logger().info('[metrics] daily snapshot done', 'groups', res.groups.join(','))
    } catch (err) {
        $app.logger().error('[metrics] daily snapshot failed', 'error', String(err))
    }
})

// Test-only escape hatch: lets integration tests trigger the snapshot on demand (cron
// schedules can't be fired on demand). Registered ONLY when METRICS_TEST_ROUTE=true —
// the route does not exist in production. Mirrors the RETENTION_TEST_ROUTE pattern in
// retention.pb.js.
if ($os.getenv('METRICS_TEST_ROUTE') === 'true') {
    routerAdd(
        'POST',
        '/api/_test/run-metrics-snapshot',
        (e) => {
            const { runDailyMetricsSnapshot } = require(`${__hooks}/jobs/metrics.js`)
            return e.json(200, runDailyMetricsSnapshot(e.app))
        },
        $apis.requireSuperuserAuth()
    )
}
