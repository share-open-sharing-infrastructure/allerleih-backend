/// <reference path="../../pb_data/types.d.ts" />

/**
 * SSRF defense-in-depth for institution-configured base URLs (currently `users.leihbackendUrl`).
 * Goja port of share-mvp `core/urlGuard.ts`. These URLs are admin-onboarded but fetched
 * server-side by the refresh cron, so a mis-set (or maliciously set) URL must not point the
 * server at itself, the PocketBase admin API, or anything else on the internal network.
 *
 * Checks the URL LITERAL only — a public hostname resolving to a private IP (DNS rebinding) is
 * out of scope, same as the TS twin.
 *
 * ⚠️ REDIRECT RESIDUAL (spike share-mvp#487 §4.4, finding 1): the TS twin also passed
 * `redirect: 'manual'` to fetch, so any 3xx was treated as a failure — closing the
 * "public URL 302→ internal host" hole. In Goja `$http.send` follows 301/302/307
 * automatically, exposes neither the intermediate 3xx nor the final URL, and offers no policy
 * hook (no raw Go http.Client is reachable from the JSVM). This literal check therefore CANNOT
 * see a redirect that lands on an internal host. Residual risk is bounded to admin-onboarded
 * URLs; documented in the runbook. Do not treat this guard as redirect-proof.
 *
 * Goja note: no dependence on a WHATWG `URL` constructor (not guaranteed in the JSVM) — the
 * scheme/host are extracted with a small manual parser instead.
 */

const PRIVATE_IPV4_RANGES = [
    /^0\./, // "this network"
    /^10\./, // RFC1918
    /^127\./, // loopback
    /^169\.254\./, // link-local
    /^172\.(1[6-9]|2\d|3[01])\./, // RFC1918
    /^192\.168\./, // RFC1918
]

/** Extracts the lowercased scheme and host (IPv6 kept bracketed, port/userinfo stripped). */
function parseSchemeHost(url) {
    const match = /^([a-zA-Z][a-zA-Z0-9+.\-]*):\/\/([^/?#]*)([\s\S]*)$/.exec(url)
    if (!match) return null

    const scheme = match[1].toLowerCase()
    let authority = match[2]
    if (authority === '') return null

    // Strip userinfo (everything up to the last '@').
    const at = authority.lastIndexOf('@')
    if (at >= 0) authority = authority.slice(at + 1)

    let host
    if (authority.charAt(0) === '[') {
        // IPv6 literal: keep the brackets (mirrors URL.hostname), ignore any :port after ']'.
        const close = authority.indexOf(']')
        if (close < 0) return null
        host = authority.slice(0, close + 1)
    } else {
        // Strip :port.
        const colon = authority.indexOf(':')
        host = colon >= 0 ? authority.slice(0, colon) : authority
    }
    if (host === '' || host === '[]') return null

    return { scheme: scheme, host: host.toLowerCase() }
}

function isPrivateHostname(hostname) {
    const host = hostname.toLowerCase()
    if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local')) return true
    for (let i = 0; i < PRIVATE_IPV4_RANGES.length; i++) {
        if (PRIVATE_IPV4_RANGES[i].test(host)) return true
    }
    // IPv6 literals arrive bracketed, e.g. "[::1]".
    if (host.charAt(0) === '[') {
        const v6 = host.slice(1, -1)
        if (v6 === '::1' || v6 === '::') return true
        if (/^fe[89ab]/.test(v6)) return true // link-local fe80::/10
        if (/^f[cd]/.test(v6)) return true // unique-local fc00::/7
        // IPv4-mapped (dotted or hex form) — reject outright.
        if (v6.indexOf('::ffff:') === 0 || v6.indexOf('.') >= 0) return true
    }
    return false
}

/**
 * Asserts that `url` is a public `https:` URL an integration may fetch server-side.
 * Throws with an ops-facing message otherwise.
 *
 * @param {string} url - the base or request URL to validate.
 * @param {boolean} [allowInsecure] - permit `http:` and private/loopback hosts (dev/tests only).
 */
function assertPublicHttpUrl(url, allowInsecure) {
    if (allowInsecure) return

    const parsed = parseSchemeHost(url)
    if (!parsed) {
        throw new Error('Invalid integration base URL: "' + url + '"')
    }
    if (parsed.scheme !== 'https') {
        throw new Error('Integration base URL must use https: — got "' + url + '"')
    }
    if (isPrivateHostname(parsed.host)) {
        throw new Error('Integration base URL must not point at a private/loopback host: "' + url + '"')
    }
}

module.exports = { assertPublicHttpUrl }
