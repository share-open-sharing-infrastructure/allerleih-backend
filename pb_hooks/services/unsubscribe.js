/// <reference path="../../pb_data/types.d.ts" />

/**
 * #607 mail deliverability — stateless HMAC one-click unsubscribe tokens + the tiny confirmation
 * web page served at GET/POST /api/unsubscribe/{purpose}/{token} (pb_hooks/unsubscribe.pb.js).
 *
 * No persisted token field: the weekly digest mails every recipient without pre-creating a
 * user_preferences row, so a persisted-token design would force a write per recipient per run
 * (plus the B2 bool-default trap — see the digestEmails migration — on every newly created row).
 * An HMAC token needs zero writes and zero schema: `${userId}.${hs256(payload, secret)}`,
 * verified by recomputing and comparing with $security.equal (timing-safe).
 *
 * No expiry: a dead unsubscribe link is worse than an old one that still works — the user's
 * alternative is hitting "report spam", which is exactly the outcome #607 exists to avoid. Mass
 * invalidation is possible via TOKEN_VERSION or by rotating UNSUBSCRIBE_SECRET.
 */

const TOKEN_VERSION = 'v1'
/** Allowlist of signable purposes; the purpose is part of the signed payload. */
const PURPOSES = ['digest']

function signaturePayload(purpose, userId) {
    return `${TOKEN_VERSION}:${purpose}:${userId}`
}

/**
 * The secret used to sign/verify tokens. Prefers the explicit UNSUBSCRIBE_SECRET env var; falls
 * back to a value derived from the `users` collection's auth-token secret (confirmed readable
 * from a JS hook — #607 spike S2). Returns '' when neither is available; callers must treat that
 * as "unsubscribe links are unavailable" (no header, no link, 503 + error log) — never throw.
 */
function unsubscribeSecret(app) {
    const { UNSUBSCRIBE_SECRET } = require(`${__hooks}/constants.js`)
    if (UNSUBSCRIBE_SECRET) return UNSUBSCRIBE_SECRET
    try {
        const secret = app.findCollectionByNameOrId('users').authToken.secret
        if (secret) return $security.hs256('allerleih/unsubscribe/' + TOKEN_VERSION, secret)
    } catch (err) {
        app.logger().error('[unsubscribe] deriving fallback secret failed', 'error', String(err))
    }
    return ''
}

/** Build a token for (userId, purpose). Returns '' if no secret is configured/derivable. */
function unsubscribeToken(app, userId, purpose) {
    const secret = unsubscribeSecret(app)
    if (!secret) return ''
    return `${userId}.${$security.hs256(signaturePayload(purpose, userId), secret)}`
}

/** Verify a token for `purpose`. Returns the userId on success, null otherwise — never throws. */
function verifyUnsubscribeToken(app, token, purpose) {
    if (!PURPOSES.includes(purpose)) return null
    if (!token || typeof token !== 'string') return null

    const dot = token.indexOf('.')
    if (dot < 1 || dot === token.length - 1) return null
    const userId = token.slice(0, dot)
    const signature = token.slice(dot + 1)

    const secret = unsubscribeSecret(app)
    if (!secret) return null

    const expected = $security.hs256(signaturePayload(purpose, userId), secret)
    if (!$security.equal(expected, signature)) return null
    return userId
}

/**
 * Full unsubscribe URL for (userId, purpose), or '' if unavailable (caller must omit the
 * header/link). #607 review S1: also bails out (logging, never the token/userId) if `assetBase()`
 * can't resolve an absolute origin at all — a relative "/api/unsubscribe/..." would be invalid per
 * RFC 8058 (List-Unsubscribe needs an absolute URI) and useless in the plaintext/HTML footer link
 * (no page context to resolve it against); no link at all is strictly better than a broken one.
 */
function unsubscribeUrl(app, userId, purpose) {
    const { assetBase } = require(`${__hooks}/utils/urls.js`)
    const token = unsubscribeToken(app, userId, purpose)
    if (!token) return ''
    const base = assetBase(app)
    if (!base) {
        app.logger().error('[unsubscribe] no usable absolute base URL (no explicit APP_URL; settings appURL empty or loopback-only; FRONTEND_URL empty) — omitting unsubscribe link')
        return ''
    }
    return `${base}/api/unsubscribe/${purpose}/${token}`
}

/**
 * Shared validation chain for both the GET (render-only) and POST (apply) routes in
 * unsubscribe.pb.js — #607 review S3, extracted to stop the purpose-allowlist/secret-check/
 * token-verify/user-existence sequence from being duplicated (and having to be kept in sync)
 * across the two routerAdd() callbacks. Returns `{ status, userId }`; `userId` is only set when
 * `status === 'ok'`. Both callers must keep mapping 'invalid' to the exact same generic HTTP
 * response for every sub-case (unknown purpose is the one exception, which 404s) — see
 * unsubscribe.pb.js's top-level doc comment for the "no user enumeration" security property this
 * exists to uphold; this function's job is only to compute the status, not to render anything, so
 * that property lives entirely at the call site.
 *
 * @returns {{status: 'unknown_purpose'|'no_secret'|'invalid'|'ok', userId?: string}}
 */
function resolveUnsubscribeRequest(app, purpose, token) {
    if (!PURPOSES.includes(purpose)) return { status: 'unknown_purpose' }
    if (!unsubscribeSecret(app)) return { status: 'no_secret' }

    const userId = verifyUnsubscribeToken(app, token, purpose)
    if (!userId) return { status: 'invalid' }

    try {
        app.findRecordById('users', userId)
    } catch (err) {
        // Signed token for a user that no longer exists — same status as a bad signature, so
        // this path can't be used to probe for valid/deleted user ids (see verifyUnsubscribeToken
        // for the one known, deliberately-accepted asymmetry: this extra lookup makes the
        // deleted-user path measurably slower than the bad-signature path, which returns above
        // without ever reaching here).
        return { status: 'invalid' }
    }

    return { status: 'ok', userId }
}

/**
 * Apply the unsubscribe: idempotent — turns digestEmails off, creating the prefs row if the user
 * never had one. A freshly-created row explicitly sets emailNotifications: true (#607 B2 — this
 * is a digest-only opt-out and must NOT also silence transactional mail like "new message").
 */
function applyUnsubscribe(app, userId, purpose) {
    if (!PURPOSES.includes(purpose)) {
        throw new Error('applyUnsubscribe: unknown purpose ' + purpose)
    }

    try {
        const rec = app.findFirstRecordByFilter('user_preferences', 'user = {:u}', { u: userId })
        rec.set('digestEmails', false)
        app.save(rec)
        return
    } catch (err) {
        // No existing row for this user — fall through to create one.
    }

    const rec = new Record(app.findCollectionByNameOrId('user_preferences'))
    rec.set('user', userId)
    rec.set('emailNotifications', true)
    rec.set('digestEmails', false)
    try {
        app.save(rec)
    } catch (err) {
        // Unique-index race: a row was created concurrently between our lookup and our insert —
        // re-fetch and update it instead of failing an otherwise-valid unsubscribe request.
        const existing = app.findFirstRecordByFilter('user_preferences', 'user = {:u}', { u: userId })
        existing.set('digestEmails', false)
        app.save(existing)
    }
}

/**
 * Render the small standalone confirmation page (NOT a mail template — pb_hooks/views/unsubscribe.html
 * is its own minimal web layout). `state` is one of 'confirm' | 'done' | 'invalid' | 'unavailable'
 * (#607 review S7: 'unavailable' — no secret configured/derivable — used to be a raw HTML
 * fragment returned directly by unsubscribe.pb.js instead of going through this renderer, so it
 * was missing `<html lang="de">`, a `<title>` and the viewport meta tag that every other state gets).
 */
function renderPage(app, state) {
    const { siteBase } = require(`${__hooks}/utils/urls.js`)
    const site = siteBase(app)
    const prefsUrl = site ? site + '/user/profile#benachrichtigungen' : ''
    return $template.loadFiles(`${__hooks}/views/unsubscribe.html`).render({ STATE: state, PREFS_URL: prefsUrl })
}

/**
 * Maps a non-'ok' `resolveUnsubscribeRequest()` status to the `{status, body}` HTTP response the
 * GET and POST handlers in unsubscribe.pb.js share — #607 review N2 (nice-to-have): this 3-way
 * status→HTTP mapping used to be a duplicated `if`/`if`/`if` block in both routerAdd() callbacks.
 * Returns `null` for `'ok'` — the caller continues into its own happy-path branch (GET renders the
 * confirm form; POST applies the unsubscribe). The three non-ok responses stay indistinguishable
 * from each other by design (see resolveUnsubscribeRequest()'s doc comment / unsubscribe.pb.js's
 * top-level doc comment for the "no user enumeration" property this upholds) — this function only
 * centralizes rendering those SAME three responses, it does not change which response goes with
 * which status.
 *
 * @returns {{status: number, body: string}|null}
 */
function errorResponseFor(app, status) {
    if (status === 'unknown_purpose') return { status: 404, body: renderPage(app, 'invalid') }
    if (status === 'no_secret') {
        app.logger().error('[unsubscribe] no secret configured/derivable — unsubscribe unavailable')
        return { status: 503, body: renderPage(app, 'unavailable') }
    }
    if (status === 'invalid') return { status: 400, body: renderPage(app, 'invalid') }
    return null
}

module.exports = {
    TOKEN_VERSION,
    PURPOSES,
    unsubscribeSecret,
    unsubscribeToken,
    verifyUnsubscribeToken,
    unsubscribeUrl,
    resolveUnsubscribeRequest,
    applyUnsubscribe,
    renderPage,
    errorResponseFor,
}
