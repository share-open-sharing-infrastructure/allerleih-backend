/// <reference path="../pb_data/types.d.ts" />

// GDPR data-retention jobs (issue #461, DSE v2.8) — nightly cron jobs that enforce
// the retention windows configured in constants.js:
//   02:00  inactive accounts  → anonymize after RETENTION_INACTIVE_MONTHS (skip open loans + mail)
//   02:10  conversations      → delete RETENTION_MESSAGES_MONTHS after last activity (incl. messages)
//   02:20  notifications      → delete after RETENTION_NOTIFICATIONS_DAYS
//   02:30  feedback           → delete after RETENTION_FEEDBACK_MONTHS
// Job logic lives in jobs/retention.js; each job is idempotent and logs only counts
// (no personal data). A window of 0 disables the corresponding job.

// Each handler resolves its cutoff via retentionCutoff (required INSIDE the handler —
// isolated context). A window of 0 disables the job; a NaN/negative window is a
// misconfiguration we log and refuse to run on, so a typo can neither silently mute a
// legally-required job nor resolve to a future cutoff that mass-deletes.

cronAdd('retentionInactiveAccounts', '0 2 * * *', () => {
    const { RETENTION_INACTIVE_MONTHS } = require(`${__hooks}/constants.js`)
    const { retentionCutoff } = require(`${__hooks}/utils/common.js`)
    const win = retentionCutoff(RETENTION_INACTIVE_MONTHS, 'months')
    if (win.disabled) return
    if (win.invalid) {
        $app.logger().error('[retention] inactive accounts: invalid RETENTION_INACTIVE_MONTHS — refusing to run', 'value', String(RETENTION_INACTIVE_MONTHS))
        return
    }
    const { purgeInactiveAccounts } = require(`${__hooks}/jobs/retention.js`)
    try {
        const res = purgeInactiveAccounts($app, win.cutoff)
        $app.logger().info(
            '[retention] inactive accounts done',
            'anonymized', res.anonymized,
            'skipped', res.skipped,
            'failed', res.failed
        )
    } catch (err) {
        $app.logger().error('[retention] inactive accounts failed', 'error', String(err))
    }
})

cronAdd('retentionConversations', '10 2 * * *', () => {
    const { RETENTION_MESSAGES_MONTHS } = require(`${__hooks}/constants.js`)
    const { retentionCutoff } = require(`${__hooks}/utils/common.js`)
    const win = retentionCutoff(RETENTION_MESSAGES_MONTHS, 'months')
    if (win.disabled) return
    if (win.invalid) {
        $app.logger().error('[retention] conversations: invalid RETENTION_MESSAGES_MONTHS — refusing to run', 'value', String(RETENTION_MESSAGES_MONTHS))
        return
    }
    const { purgeOldConversations } = require(`${__hooks}/jobs/retention.js`)
    try {
        const res = purgeOldConversations($app, win.cutoff)
        $app.logger().info('[retention] conversations done', 'deleted', res.deleted, 'failed', res.failed)
    } catch (err) {
        $app.logger().error('[retention] conversations failed', 'error', String(err))
    }
})

cronAdd('retentionNotifications', '20 2 * * *', () => {
    const { RETENTION_NOTIFICATIONS_DAYS } = require(`${__hooks}/constants.js`)
    const { retentionCutoff } = require(`${__hooks}/utils/common.js`)
    const win = retentionCutoff(RETENTION_NOTIFICATIONS_DAYS, 'days')
    if (win.disabled) return
    if (win.invalid) {
        $app.logger().error('[retention] notifications: invalid RETENTION_NOTIFICATIONS_DAYS — refusing to run', 'value', String(RETENTION_NOTIFICATIONS_DAYS))
        return
    }
    const { purgeOldNotifications } = require(`${__hooks}/jobs/retention.js`)
    try {
        const res = purgeOldNotifications($app, win.cutoff)
        $app.logger().info('[retention] notifications done', 'deleted', res.deleted)
    } catch (err) {
        $app.logger().error('[retention] notifications failed', 'error', String(err))
    }
})

cronAdd('retentionFeedback', '30 2 * * *', () => {
    const { RETENTION_FEEDBACK_MONTHS } = require(`${__hooks}/constants.js`)
    const { retentionCutoff } = require(`${__hooks}/utils/common.js`)
    const win = retentionCutoff(RETENTION_FEEDBACK_MONTHS, 'months')
    if (win.disabled) return
    if (win.invalid) {
        $app.logger().error('[retention] feedback: invalid RETENTION_FEEDBACK_MONTHS — refusing to run', 'value', String(RETENTION_FEEDBACK_MONTHS))
        return
    }
    const { purgeOldFeedback } = require(`${__hooks}/jobs/retention.js`)
    try {
        const res = purgeOldFeedback($app, win.cutoff)
        $app.logger().info('[retention] feedback done', 'deleted', res.deleted)
    } catch (err) {
        $app.logger().error('[retention] feedback failed', 'error', String(err))
    }
})

// Test-only escape hatch: lets the integration tests trigger a job with an explicit
// cutoff over HTTP (cron schedules can't be fired on demand). Registered ONLY when
// RETENTION_TEST_ROUTE=true — the route does not exist in production.
if ($os.getenv('RETENTION_TEST_ROUTE') === 'true') {
    routerAdd(
        'POST',
        '/api/_test/run-retention/{job}',
        (e) => {
            const jobs = require(`${__hooks}/jobs/retention.js`)
            const handlers = {
                'inactive-accounts': jobs.purgeInactiveAccounts,
                conversations: jobs.purgeOldConversations,
                notifications: jobs.purgeOldNotifications,
                feedback: jobs.purgeOldFeedback,
            }

            const job = e.request.pathValue('job')
            const handler = handlers[job]
            if (!handler) {
                return e.json(404, { code: 'unknown_job', message: 'Unknown retention job.' })
            }

            const info = e.requestInfo()
            const cutoff = info.body && info.body.cutoff ? String(info.body.cutoff) : ''
            if (!cutoff) {
                return e.json(400, { code: 'missing_cutoff', message: 'Body must contain a cutoff.' })
            }

            return e.json(200, handler($app, cutoff))
        },
        $apis.requireSuperuserAuth()
    )
}
