/// <reference path="../../pb_data/types.d.ts" />

/**
 * WINBIAP WebOPAC refresh integration (status only). Goja port of share-mvp
 * `winbiap/client.ts` + `winbiap/index.ts`. Looks up one item's current availability by its
 * full barcode via `Job=Search&SearchCondition1=46`, and produces a status-only update.
 *
 * $http.send notes (spike share-mvp#487 §4.4): `timeout` is in SECONDS; the query string is
 * transmitted byte-for-byte as written (so the `%2B`→`+` retry works identically to `fetch`);
 * `res.json` is the parsed body. `$http.send` follows redirects — a redirect onto an unexpected
 * page yields a body without a `Data` array, which we treat as a transient failure (see below).
 */

const { assertPublicHttpUrl } = require(`${__hooks}/integrations/urlGuard.js`)
const { INTEGRATION_ALLOW_INSECURE_URL } = require(`${__hooks}/constants.js`)

const TIMEOUT_SECONDS = 10

// Mediennummer search condition code (docs/winbiap_api-search.pdf §5.1.1).
const SEARCH_CONDITION_MEDIENNUMMER = 46

// Exemplar StatusIds that count as "not lendable right now" (entliehen / vorbestellt / Präsenz).
const UNAVAILABLE_STATUS_IDS = [2, 3, 100]
const AVAILABLE_STATUS_ID = 1

const BROWSER_HEADERS = {
    'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    Accept: '*/*',
}

/** Strips trailing slashes from a WebOPAC base URL. */
function normalizeBaseUrl(url) {
    return String(url || '').replace(/\/+$/, '')
}

/**
 * Derives an AllerLeih status from a catalogue record's exemplar list, per the proven script:
 * any exemplar available ⇒ `available`; a non-empty list all entliehen/vorbestellt/Präsenz ⇒
 * `unavailable`; anything else (empty, or mixed/unknown StatusIds) ⇒ `unknown`.
 */
function statusFromMediaItems(mediaItems) {
    const ids = (mediaItems || []).map((item) => item.StatusId)
    if (ids.length === 0) return 'unknown'
    if (ids.some((id) => id === AVAILABLE_STATUS_ID)) return 'available'
    if (ids.every((id) => id !== undefined && UNAVAILABLE_STATUS_IDS.indexOf(id) >= 0)) return 'unavailable'
    return 'unknown'
}

/**
 * Builds the WebOPAC search URL. `encodeURIComponent` percent-encodes '$' and '+'; some servers
 * treat '%2B' and a literal '+' differently, so the caller can retry with '+' left literal.
 */
function buildSearchUrl(base, barcode, encodePlus) {
    let value = encodeURIComponent(barcode)
    if (!encodePlus) value = value.replace(/%2B/g, '+')
    return (
        base +
        '/service/cataloguedata.aspx?json=1&Job=Search&SearchCondition1=' +
        SEARCH_CONDITION_MEDIENNUMMER +
        '&SearchValue1=' +
        value +
        '&nostats=1'
    )
}

/** Sends one search request and returns the parsed body, or throws on any failure. */
function requestSearch(url, base) {
    let response
    try {
        response = $http.send({
            url: url,
            method: 'GET',
            timeout: TIMEOUT_SECONDS,
            headers: Object.assign({}, BROWSER_HEADERS, { Referer: base + '/' }),
        })
    } catch (err) {
        throw new Error('Request to ' + url + ' failed: ' + String(err))
    }

    if (response.statusCode < 200 || response.statusCode >= 300) {
        throw new Error('Unexpected status ' + response.statusCode + ' from ' + url)
    }

    let body
    try {
        body = response.json
    } catch (err) {
        body = null
    }
    // A well-formed response always carries a `Data` array; its absence means an unexpected body
    // (a maintenance page, or a followed redirect landing elsewhere) — treat as transient rather
    // than "item gone".
    if (!body || !Array.isArray(body.Data)) {
        throw new Error('Response from ' + url + ' has no Data array')
    }
    return body
}

/**
 * Looks up one item's current availability by its full barcode (e.g. `118$5031208P`).
 * @returns `{ found: false }` when the catalogue has no such item (→ archive), or
 *          `{ found: true, status }` with the derived availability.
 * @throws on network / non-2xx / unexpected-body failures (→ transient, leave as-is).
 */
function fetchItemStatus(baseUrl, barcode) {
    const base = normalizeBaseUrl(baseUrl)
    assertPublicHttpUrl(base, INTEGRATION_ALLOW_INSECURE_URL)

    let body = requestSearch(buildSearchUrl(base, barcode, true), base)

    // Fallback: barcodes containing '+' sometimes only match with '+' sent literally.
    if (body.Data.length === 0 && barcode.indexOf('+') >= 0) {
        body = requestSearch(buildSearchUrl(base, barcode, false), base)
    }

    const record = body.Data[0]
    if (!record) return { found: false }

    const mediaItems = record.CatalogData ? record.CatalogData.MediaItemsUnsorted : undefined
    return { found: true, status: statusFromMediaItems(mediaItems) }
}

/**
 * True if a base URL is a WINBIAP WebOPAC, per the documented convention (path contains
 * `/webopac`, e.g. `https://rblg.stadt.lueneburg.de/webopac`). The canonical source-type sniff —
 * reused by `isWinbiapInstitution` and by the #487 Phase 2 `sync_config` backfill (do not
 * re-implement the heuristic elsewhere).
 */
function isWinbiapUrl(url) {
    return String(url || '').toLowerCase().indexOf('/webopac') >= 0
}

/**
 * True for institutions served by the WINBIAP integration. As of #487 Phase 2 discovery comes
 * from `sync_config`, so this reads the authoritative `integration` field rather than sniffing the
 * URL. (`isWinbiapUrl` above stays as the sniff used by the one-time `sync_config` backfill.)
 */
function isWinbiapInstitution(institution) {
    return !!institution && institution.integration === 'winbiap'
}

/**
 * True for items that came from a WINBIAP WebOPAC: their deep link lives under `/webopac/`, and
 * their `externalId` is a `{libraryId}${Mediennummer}` barcode. The `externalId` check also
 * catches items imported without API enrichment, whose `externalUrl` is empty.
 */
function isWinbiapItem(item) {
    return (
        String(item.externalUrl || '').toLowerCase().indexOf('/webopac/') >= 0 ||
        String(item.externalId || '').indexOf('$') >= 0
    )
}

/** Builds a status-only mapped item: the stored item's synced fields with `status` replaced. */
function withStatus(item, status, ownerId) {
    return {
        externalId: item.externalId || '',
        name: item.name,
        description: item.description,
        categories: item.categories,
        place: item.place,
        externalUrl: item.externalUrl,
        externalImgUrl: item.externalImgUrl,
        status: status,
        owner: ownerId,
        trusteesOnly: false, // type-filler: not written on update (applyDiff writes only synced fields)
    }
}

/**
 * Re-fetches one stored WINBIAP item's availability and produces a status-only update.
 * No catalogue hit ⇒ `gone` (archive); a transient fetch failure throws (the refresh flow
 * records it and leaves the item untouched).
 */
function refreshOne(institution, item) {
    const baseUrl = (institution && institution.baseUrl) || ''
    const result = fetchItemStatus(normalizeBaseUrl(baseUrl), item.externalId || '')
    if (!result.found) return { kind: 'gone' }
    return { kind: 'found', item: withStatus(item, result.status, institution.id) }
}

/** Refresh integration for WINBIAP WebOPAC items (status only). Registered FIRST (specific). */
const winbiapRefreshIntegration = {
    id: 'winbiap',
    claimsInstitution: isWinbiapInstitution,
    claimsItem: isWinbiapItem,
    fetchOne: refreshOne,
    pauseMsBetweenFetches: 500, // spare the library WebOPAC from a burst of per-item requests
}

module.exports = {
    winbiapRefreshIntegration,
    isWinbiapUrl,
    isWinbiapInstitution,
    isWinbiapItem,
    statusFromMediaItems,
    normalizeBaseUrl,
    fetchItemStatus,
}
