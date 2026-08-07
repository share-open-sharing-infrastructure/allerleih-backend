/// <reference path="../pb_data/types.d.ts" />

/**
 * #607 mail deliverability — one-click unsubscribe (RFC 8058) for the weekly digest.
 *
 *   GET  /api/unsubscribe/{purpose}/{token}  — confirmation page; NEVER mutates state. Mail
 *        security scanners (Outlook SafeLinks, Proofpoint, ...) follow links found in incoming
 *        mail; a write on GET would silently unsubscribe users who never clicked anything
 *        themselves. GET stays safe/idempotent in the HTTP sense.
 *   POST /api/unsubscribe/{purpose}/{token}  — actually unsubscribes; idempotent. RFC 8058
 *        requires the confirmation-free one-click action to be POST, never GET.
 *
 * Deliberately public (no requireAuth()) — the whole point is a logged-out mail client can hit
 * it. Security properties (see #607 plan section 2.7 for the full rationale):
 *   - no user enumeration in body or status code: unknown user / bad signature / a signature
 *     that's valid for a since-deleted user all resolve to the SAME generic "invalid" response —
 *     nothing in the body or status reveals which of the three occurred. NOTE this claim is
 *     scoped to body+status, not timing: the deleted-user case does one extra DB lookup
 *     (resolveUnsubscribeRequest in services/unsubscribe.js) that the bad-signature case never
 *     reaches, so the two are NOT timing-identical. Left as-is deliberately — without
 *     UNSUBSCRIBE_SECRET nobody can forge a validly-signed token for someone else's id in the
 *     first place, so this channel only ever leaks information about a token the caller already
 *     holds; a same-duration dummy lookup to close it would be cargo-cult hardening, not a real fix;
 *   - the token is never echoed back into the response; the confirm form posts to "" (empty
 *     action — no token reflected into markup, no injection surface from it);
 *   - nothing here logs the token, user id or email — only status codes.
 *
 * The purpose-allowlist/secret-check/token-verify/user-existence validation chain itself lives in
 * services/unsubscribe.js's `resolveUnsubscribeRequest()` (#607 review S3 — it used to be
 * duplicated near-verbatim across both callbacks below); the status→HTTP-response mapping for
 * every non-'ok' outcome lives there too, as `errorResponseFor()` (#607 review N2 — that was also a
 * duplicated 3-way if/else in both callbacks). This file only calls both and handles its own 'ok'
 * happy-path branch (GET renders the confirm form; POST applies the unsubscribe). That module is
 * require()'d fresh inside each handler — this file's own top-level scope is NOT reliably visible
 * inside routerAdd callbacks (each fires in its own isolated JS context; only require()'d modules
 * and locals declared inside the handler body are safe), so nothing besides the two routerAdd(...)
 * registrations lives at this file's top level.
 */

routerAdd('GET', '/api/unsubscribe/{purpose}/{token}', (e) => {
    const { resolveUnsubscribeRequest, errorResponseFor, renderPage } = require(`${__hooks}/services/unsubscribe.js`)

    const purpose = e.request.pathValue('purpose')
    const token = e.request.pathValue('token')
    const result = resolveUnsubscribeRequest($app, purpose, token)

    const errorResponse = errorResponseFor($app, result.status)
    if (errorResponse) return e.html(errorResponse.status, errorResponse.body)

    // GET never writes — only renders the confirmation form (regardless of current state).
    return e.html(200, renderPage($app, 'confirm'))
})

routerAdd('POST', '/api/unsubscribe/{purpose}/{token}', (e) => {
    const { resolveUnsubscribeRequest, applyUnsubscribe, errorResponseFor, renderPage } = require(`${__hooks}/services/unsubscribe.js`)

    const purpose = e.request.pathValue('purpose')
    const token = e.request.pathValue('token')
    const result = resolveUnsubscribeRequest($app, purpose, token)

    const errorResponse = errorResponseFor($app, result.status)
    if (errorResponse) return e.html(errorResponse.status, errorResponse.body)

    try {
        applyUnsubscribe($app, result.userId, purpose)
    } catch (err) {
        // Never log the token/userId/email — counts/status only.
        $app.logger().error('[unsubscribe] apply failed', 'purpose', purpose)
        return e.html(400, renderPage($app, 'invalid'))
    }

    return e.html(200, renderPage($app, 'done'))
})
