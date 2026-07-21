/// <reference path="../pb_data/types.d.ts" />

/**
 * Integration sync scheduling — registers the two cron jobs. Schedules come from SYNC_CRON /
 * REFRESH_CRON (standard 5-field cron expressions); an empty/unset variable disables that job.
 *
 * BOTH jobs run LOCALLY in the backend (native $app, per-institution transaction, shared
 * $app.store() overlap lock) — no HTTP POST to the frontend:
 * - `integration_sync`    → require(`${__hooks}/integrations/sync.js`).runSync()    (full pull)
 * - `integration_refresh` → require(`${__hooks}/integrations/refresh.js`).runRefresh() (per-item)
 *
 * Both discover institutions from the `sync_config` collection; neither needs any frontend
 * config (#487 Phase 3 removed the old SYNC_SECRET / frontend-POST path entirely).
 *
 * This top-level code runs once at load time, so requiring constants.js here is fine — but the
 * cron callbacks execute later in an ISOLATED context: they see no top-level variables at all
 * (not even loop variables), only globals and literals. Hence the verbatim cronAdd blocks below.
 */
const { SYNC_CRON, REFRESH_CRON } = require(`${__hooks}/constants.js`)

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

/** True when the expression is schedulable; logs the fail-soft error otherwise. */
function cronExpressionValid(label, cronVarName, expr) {
    if (isValidCron(expr)) return true
    $app.logger().error(
        `[cron:${label}] ${cronVarName} is not a valid 5-field cron expression — job not scheduled.`,
        'cron', expr
    )
    return false
}

// Fail-soft is per job: an invalid expression logs and leaves that job unscheduled without
// affecting the sibling.
if (SYNC_CRON && cronExpressionValid('sync', 'SYNC_CRON', SYNC_CRON)) {
    cronAdd('integration_sync', SYNC_CRON, () => {
        require(`${__hooks}/integrations/sync.js`).runSync()
    })
    $app.logger().info('[cron:sync] scheduled local full catalogue pull', 'cron', SYNC_CRON)
}

if (REFRESH_CRON && cronExpressionValid('refresh', 'REFRESH_CRON', REFRESH_CRON)) {
    cronAdd('integration_refresh', REFRESH_CRON, () => {
        require(`${__hooks}/integrations/refresh.js`).runRefresh()
    })
    $app.logger().info('[cron:refresh] scheduled local per-item refresh', 'cron', REFRESH_CRON)
}
