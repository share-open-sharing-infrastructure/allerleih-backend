/// <reference path="../pb_data/types.d.ts" />

/**
 * Integration sync scheduling — registers the two cron jobs. Schedules come from SYNC_CRON /
 * REFRESH_CRON (standard 5-field cron expressions); an empty/unset variable disables that job.
 *
 * - `integration_sync` (full catalogue pull): POSTs the frontend's bearer-protected /api/sync
 *   (unchanged — needs FRONTEND_URL + SYNC_SECRET). Body in jobs/integrationSync.js.
 * - `integration_refresh` (per-item refresh): as of #487 Phase 1 runs LOCALLY in the backend via
 *   pb_hooks/integrations/refresh.js (native $app, per-institution transaction, $app.store()
 *   overlap lock) — no HTTP call, so it needs only a valid REFRESH_CRON.
 *
 * This top-level code runs once at load time, so requiring constants.js here is
 * fine — but the cron callbacks execute later in an ISOLATED context: they see
 * no top-level variables at all (not even loop variables), only globals and
 * literals. Hence the verbatim cronAdd blocks below.
 */
const { FRONTEND_URL, SYNC_SECRET, SYNC_CRON, REFRESH_CRON } = require(`${__hooks}/constants.js`)

/**
 * Validates a cron expression against the grammar PocketBase's scheduler accepts
 * (5 fields of numbers / `*` / ranges / steps / lists, or a `@daily`-style macro).
 * cronAdd() PANICS on an invalid expression, and a Go panic is not catchable from
 * JS — it kills this whole hook file, taking the sibling job down with it. So we
 * validate here and fail soft instead.
 */
function isValidCron(expr) {
    if (['@yearly', '@annually', '@monthly', '@weekly', '@daily', '@midnight', '@hourly'].includes(expr)) {
        return true
    }
    const fields = expr.trim().split(/\s+/)
    if (fields.length !== 5) return false
    const bounds = [[0, 59], [0, 23], [1, 31], [1, 12], [0, 6]] // minute hour day month weekday
    return fields.every((field, i) => {
        const [min, max] = bounds[i]
        return field.split(',').every((part) => {
            const segments = part.split('/')
            if (segments.length > 2 || (segments[1] !== undefined && !/^\d+$/.test(segments[1]))) return false
            if (segments[0] === '*') return true
            const range = segments[0].split('-')
            if (range.length > 2) return false
            return (
                range.every((n) => /^\d+$/.test(n) && +n >= min && +n <= max) &&
                (range.length === 1 || +range[0] <= +range[1])
            )
        })
    })
}

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

// The bearer secret travels as a header — over cross-host plain http it goes out in cleartext.
// Only the sync job POSTs the frontend now (refresh runs locally), so only SYNC_CRON matters here.
// Loopback targets (local dev, same-host reverse proxy) are fine.
if (SYNC_CRON && /^http:\/\//.test(FRONTEND_URL)) {
    const host = FRONTEND_URL.replace(/^http:\/\//, '').replace(/[:/].*$/, '')
    if (host !== 'localhost' && host !== '127.0.0.1' && host !== '[::1]') {
        $app.logger().warn(
            '[cron:sync] FRONTEND_URL is non-loopback http:// — SYNC_SECRET will be sent in cleartext. Use https.',
            'url', FRONTEND_URL
        )
    }
}

/** True when the expression is schedulable; logs the fail-soft error otherwise. */
function cronExpressionValid(label, cronVarName, expr) {
    if (isValidCron(expr)) return true
    $app.logger().error(
        `[cron:${label}] ${cronVarName} is not a valid 5-field cron expression — job not scheduled.`,
        'cron', expr
    )
    return false
}

if (SYNC_CRON && syncTargetConfigured('sync', 'SYNC_CRON') && cronExpressionValid('sync', 'SYNC_CRON', SYNC_CRON)) {
    cronAdd('integration_sync', SYNC_CRON, () => {
        const { triggerIntegrationEndpoint } = require(`${__hooks}/jobs/integrationSync.js`)
        triggerIntegrationEndpoint('sync', '/api/sync')
    })
    $app.logger().info('[cron:sync] scheduled /api/sync', 'cron', SYNC_CRON, 'target', FRONTEND_URL)
}

// Refresh runs locally now — no FRONTEND_URL/SYNC_SECRET needed, only a valid expression.
// Fail-soft is preserved: an invalid REFRESH_CRON logs and is not scheduled, leaving
// integration_sync unaffected (and vice-versa).
if (REFRESH_CRON && cronExpressionValid('refresh', 'REFRESH_CRON', REFRESH_CRON)) {
    cronAdd('integration_refresh', REFRESH_CRON, () => {
        require(`${__hooks}/integrations/refresh.js`).runRefresh()
    })
    $app.logger().info('[cron:refresh] scheduled local per-item refresh', 'cron', REFRESH_CRON)
}
