/// <reference path="../../pb_data/types.d.ts" />

/**
 * #607 mail deliverability — URL base helpers.
 *
 * `app.settings().meta.appURL` is, per the #447 decision (see mail_config.pb.js), the BACKEND
 * origin: it is only ever WRITTEN from an explicitly-set APP_URL env var, so that the
 * `_superusers` admin-mail links (`{APP_URL}/_/#/...`) keep resolving to the PocketBase admin UI.
 * User-facing app links (items, search, conversations, auth pages) instead need the SvelteKit
 * FRONTEND origin. Mixing the two up is exactly bug B1 from the #607 plan (digest item links and
 * the retention-warning login link 404'd against the backend host).
 *
 * Convention: both bases are returned WITHOUT a trailing slash — the caller supplies the slash,
 * identical to how FRONTEND_URL (constants.js) and the `{APP_URL}/_/#/...` auth-mail templates
 * already work.
 *
 * #607 review S8 (empirically verified, not just read): a stock PocketBase instance that never had
 * APP_URL set reports `settings().meta.appURL === 'http://localhost:8090'` — PocketBase's own
 * built-in default, NOT an empty string (the Settings model rejects a blank appURL outright, so a
 * real running instance can never actually reach an empty one). assetBase()'s previous
 * `|| FRONTEND_URL` fallback therefore never fired for this — very plausible — production
 * misconfiguration: an operator configures SMTP through the admin UI and forgets APP_URL. The old
 * "legitimately have an empty appURL" comment on that fallback was wrong; see isLoopbackHost()
 * below for the actual fix.
 */

/** Strip any trailing slash(es) from a URL. */
function noTrailingSlash(url) {
    return String(url || '').replace(/\/+$/, '')
}

/**
 * True when `url`'s host is loopback (localhost / 127.0.0.0/8 / `[::1]`) — exactly what
 * PocketBase's own built-in `settings().meta.appURL` default ("http://localhost:8090") is, and
 * what the README's local-SMTP-testing recipe explicitly sets APP_URL to
 * ("http://127.0.0.1:8090"). A mail that leaves the machine can never reach either. Deliberately
 * narrow — just the loopback host, not the wider private-IP-range SSRF guard in
 * `integrations/urlGuard.js`: that guards a different threat model (admin-onboarded, potentially
 * adversarial integration base URLs), not this trusted operator-or-PocketBase-default value.
 */
function isLoopbackHost(url) {
    const match = /^[a-zA-Z][a-zA-Z0-9+.-]*:\/\/([^/?#]*)/.exec(String(url || ''))
    if (!match) return false

    let host = match[1]
    const at = host.lastIndexOf('@')
    if (at >= 0) host = host.slice(at + 1)
    if (host.charAt(0) === '[') {
        const close = host.indexOf(']')
        host = close >= 0 ? host.slice(0, close + 1) : host
    } else {
        const colon = host.indexOf(':')
        if (colon >= 0) host = host.slice(0, colon)
    }
    host = host.toLowerCase()

    return host === 'localhost' || host === '[::1]' || /^127\.\d+\.\d+\.\d+$/.test(host)
}

/**
 * Backend origin — pb_public assets (e.g. the logo), `/api/files/...`, the unsubscribe endpoint.
 * Both consumers (services/mail.js, services/unsubscribe.js) embed this into content of an
 * OUTGOING mail — there is no other call site — so "must be reachable from wherever the mail ends
 * up" applies unconditionally here.
 *
 * Resolution order:
 *   1. an EXPLICITLY-set `APP_URL` env var, read raw (not `constants.js`'s `APP_URL` export, which
 *      silently defaults to FRONTEND_URL) — mirrors mail_config.pb.js's own "was this explicitly
 *      set" check. An explicit value is deliberate operator intent — even a loopback one (the
 *      README's local-SMTP-testing recipe sets `APP_URL=http://127.0.0.1:8090` on purpose) — so it
 *      is honored unconditionally, never second-guessed by the loopback check below;
 *   2. `settings().meta.appURL`, unless it is a loopback host — without an explicit APP_URL that
 *      value is either something an operator set via the admin UI, or PocketBase's own untouched
 *      built-in default; a loopback value can only be the latter, so it is never handed to an
 *      outgoing mail;
 *   3. FRONTEND_URL;
 *   4. `''` — no usable absolute base. Callers (`unsubscribeUrl()`) must treat that as "omit the
 *      link/asset", never as license to fall back to a relative URL.
 */
function assetBase(app) {
    const { FRONTEND_URL } = require(`${__hooks}/constants.js`)

    const explicitAppUrl = $os.getenv('APP_URL') || ''
    if (explicitAppUrl) return noTrailingSlash(explicitAppUrl)

    const settingsAppUrl = noTrailingSlash(app.settings().meta.appURL)
    if (settingsAppUrl && !isLoopbackHost(settingsAppUrl)) return settingsAppUrl

    return noTrailingSlash(FRONTEND_URL)
}

/** Frontend origin — all user-facing app links (/items, /search, /conversations, /auth/login, ...). */
function siteBase(app) {
    const { FRONTEND_URL } = require(`${__hooks}/constants.js`)
    return noTrailingSlash(FRONTEND_URL) || noTrailingSlash(app.settings().meta.appURL)
}

module.exports = { noTrailingSlash, assetBase, siteBase }
