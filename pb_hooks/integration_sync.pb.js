/// <reference path="../pb_data/types.d.ts" />

/**
 * Integration sync scheduling — registers cron jobs that POST the frontend's
 * bearer-protected /api/sync (full catalogue pull) and /api/refresh (per-item
 * refresh) endpoints. Schedules come from SYNC_CRON / REFRESH_CRON (standard
 * 5-field cron expressions); an empty/unset variable disables that job.
 * Job bodies live in jobs/integrationSync.js.
 *
 * This top-level code runs once at load time, so requiring constants.js here is
 * fine — but the cron callbacks execute later in an ISOLATED context: they see
 * no top-level variables at all (not even loop variables), only globals and
 * literals. Hence the two verbatim cronAdd blocks below.
 */
const { FRONTEND_URL, SYNC_SECRET, SYNC_CRON, REFRESH_CRON } = require(`${__hooks}/constants.js`)

/** Logs why a configured job cannot be scheduled. Returns true when config is complete. */
function syncTargetConfigured(label, cronVarName) {
    if (FRONTEND_URL && SYNC_SECRET) return true
    $app.logger().error(
        `[cron:${label}] ${cronVarName} is set but ` +
        `${!FRONTEND_URL ? 'FRONTEND_URL' : 'SYNC_SECRET'} is missing — job not scheduled. ` +
        'Set FRONTEND_URL and SYNC_SECRET in the backend environment.'
    )
    return false
}

if (SYNC_CRON && syncTargetConfigured('sync', 'SYNC_CRON')) {
    cronAdd('integration_sync', SYNC_CRON, () => {
        const { triggerIntegrationEndpoint } = require(`${__hooks}/jobs/integrationSync.js`)
        triggerIntegrationEndpoint('sync', '/api/sync')
    })
    $app.logger().info('[cron:sync] scheduled /api/sync', 'cron', SYNC_CRON, 'target', FRONTEND_URL)
}

if (REFRESH_CRON && syncTargetConfigured('refresh', 'REFRESH_CRON')) {
    cronAdd('integration_refresh', REFRESH_CRON, () => {
        const { triggerIntegrationEndpoint } = require(`${__hooks}/jobs/integrationSync.js`)
        triggerIntegrationEndpoint('refresh', '/api/refresh')
    })
    $app.logger().info('[cron:refresh] scheduled /api/refresh', 'cron', REFRESH_CRON, 'target', FRONTEND_URL)
}
