/// <reference path="../../pb_data/types.d.ts" />

/**
 * Cron job bodies for the integration sync — POST the frontend's bearer-protected
 * /api/sync and /api/refresh endpoints, which pull institutional catalogues from
 * their external lending software. Registered in integration_sync.pb.js.
 */

/**
 * Calls one integration endpoint on the frontend and logs the per-institution
 * summaries it returns. Never throws — a failed run must not crash the scheduler.
 *
 * @param {'sync'|'refresh'} label - Log prefix, matches the endpoint's own log label.
 * @param {string} path - Endpoint path on the frontend, e.g. '/api/sync'.
 */
function triggerIntegrationEndpoint(label, path) {
    const { FRONTEND_URL, SYNC_SECRET, SYNC_TIMEOUT_SECONDS, DRY_MODE } = require(`${__hooks}/constants.js`)
    const logPrefix = `[cron:${label}]`

    if (DRY_MODE) {
        $app.logger().info(`${logPrefix} DRY_MODE — skipping call to ${path}`)
        return
    }

    let res
    try {
        res = $http.send({
            url: FRONTEND_URL + path,
            method: 'POST',
            headers: { Authorization: `Bearer ${SYNC_SECRET}` },
            timeout: SYNC_TIMEOUT_SECONDS,
        })
    } catch (err) {
        $app.logger().error(`${logPrefix} request failed`, 'url', FRONTEND_URL + path, 'error', String(err))
        return
    }

    if (res.statusCode !== 200) {
        $app.logger().error(
            `${logPrefix} non-200 response`,
            'status', res.statusCode,
            'body', String(res.raw).slice(0, 500)
        )
        return
    }

    // A 200 with a non-JSON body (a reverse proxy or SPA shell answering the
    // request) yields a falsy/non-object res.json — without this check it would
    // masquerade as a successful "no institutions configured" run.
    let json
    try {
        json = res.json
    } catch (err) {
        json = null
    }
    if (!json || typeof json !== 'object') {
        $app.logger().error(`${logPrefix} invalid JSON body`, 'body', String(res.raw).slice(0, 500))
        return
    }
    const summaries = json.summaries || []
    if (summaries.length === 0) {
        $app.logger().info(`${logPrefix} done — no institutions configured`)
        return
    }
    for (const s of summaries) {
        const line =
            `${logPrefix} ${s.institution}: fetched=${s.fetched} created=${s.created} ` +
            `updated=${s.updated} archived=${s.archived} skipped=${s.skipped} ` +
            `errors=${(s.errors || []).length} (${s.durationMs}ms)`
        if ((s.errors || []).length > 0) {
            $app.logger().error(line, 'errors', JSON.stringify(s.errors))
        } else {
            $app.logger().info(line)
        }
    }
}

module.exports = { triggerIntegrationEndpoint }
