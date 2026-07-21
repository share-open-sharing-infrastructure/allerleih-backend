/// <reference path="../../pb_data/types.d.ts" />

/**
 * WINBIAP WebOPAC refresh integration. Goja port of share-mvp `winbiap/client.ts` +
 * `winbiap/index.ts`. Looks up one item's current catalogue record by its full barcode via
 * `Job=Search&SearchCondition1=46`, and re-maps name/description/status from it. Categories,
 * place, externalUrl and externalImgUrl are carried over from the stored item unchanged — the
 * WebOPAC search response has no AllerLeih-specific fields (category, a public deep link, …).
 *
 * $http.send notes (spike share-mvp#487 §4.4): `timeout` is in SECONDS; the query string is
 * transmitted byte-for-byte as written (so the `%2B`→`+` retry works identically to `fetch`);
 * `res.json` is the parsed body. `$http.send` follows redirects — a redirect onto an unexpected
 * page yields a body without a `Data` array, which we treat as a transient failure (see below).
 */

const { assertPublicHttpUrl } = require(`${__hooks}/integrations/urlGuard.js`)
const { INTEGRATION_ALLOW_INSECURE_URL } = require(`${__hooks}/constants.js`)

const TIMEOUT_SECONDS = 10
const MAX_NAME_LENGTH = 200
const MAX_DESCRIPTION_LENGTH = 5000

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
 * Looks up one item's current catalogue record by its full barcode (e.g. `118$5031208P`).
 * @returns `{ found: false }` when the catalogue has no such item (→ archive), or
 *          `{ found: true, record }` — the raw `Data[0]` entry (`CatalogData` + `HasCover`).
 * @throws on network / non-2xx / unexpected-body failures (→ transient, leave as-is).
 */
function fetchItemRecord(baseUrl, barcode) {
    const base = normalizeBaseUrl(baseUrl)
    assertPublicHttpUrl(base, INTEGRATION_ALLOW_INSECURE_URL)

    let body = requestSearch(buildSearchUrl(base, barcode, true), base)

    // Fallback: barcodes containing '+' sometimes only match with '+' sent literally.
    if (body.Data.length === 0 && barcode.indexOf('+') >= 0) {
        body = requestSearch(buildSearchUrl(base, barcode, false), base)
    }

    const record = body.Data[0]
    if (!record) return { found: false }
    return { found: true, record: record }
}

/**
 * Formats an ISO datetime (`YYYY-MM-DDTHH:mm:ss`, WINBIAP's fixed shape) as German-style
 * `DD.MM.YYYY`, or `null` for a missing value or the .NET default zero-date
 * (`0001-01-01T...`, meaning "not applicable" — e.g. a copy that isn't currently on loan has
 * no real `DateOfReturn`). Regex-parsed rather than via `Date` to avoid any JS-engine-specific
 * ISO-parsing/timezone ambiguity in Goja.
 */
function formatGermanDate(iso) {
    const m = /^(\d{4})-(\d{2})-(\d{2})T/.exec(String(iso || ''))
    if (!m) return null
    const year = m[1]
    if (year === '0001') return null
    return m[3] + '.' + m[2] + '.' + year
}

/**
 * Squashes a handful of WebOPAC catalogue fields into the item description: the free-text
 * annotation, the title's total copy count, this specific exemplar's branch, its current due
 * date if out on loan, and — last, by design — its reservation queue.
 */
function buildDescription(catalogData, exemplar) {
    const lines = []

    const annotation = String(catalogData.Annotation || '').trim()
    if (annotation) lines.push(annotation)

    if (catalogData.CountCopies) lines.push('Exemplare: ' + catalogData.CountCopies)
    if (exemplar.BranchName) lines.push('Standort: ' + exemplar.BranchName)

    const returnDate = formatGermanDate(exemplar.Borrow && exemplar.Borrow.DateOfReturn)
    if (returnDate) lines.push('verliehen bis ' + returnDate)

    if (catalogData.ReservationCount > 0) {
        lines.push('Schon von ' + catalogData.ReservationCount + ' Menschen vorbestellt')
    }

    return lines.join('\n').slice(0, MAX_DESCRIPTION_LENGTH)
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

/**
 * Maps a WebOPAC search result to AllerLeih `items` fields. `name`/`description`/`status` are
 * re-derived from the fetched record; `categories`/`place`/`externalUrl`/`externalImgUrl` are
 * carried over from the stored item unchanged (the search response has no equivalents for
 * those). The exemplar used for `Standort`/`verliehen bis` is `MediaItemsUnsorted[0]` — since
 * the search is by exact barcode, that array holds exactly the one physical copy this item's
 * `externalId` identifies (`CatalogData.CountCopies` is the *title's* total copies across all
 * branches, a different number).
 *
 * `name` falls back to the stored name when the record carries no `Titel1`: `items.name` is
 * `required`, and `applyDiff` runs inside one all-or-nothing per-institution transaction — a
 * single title-less record would otherwise roll back that institution's entire refresh on
 * every run.
 */
function mapItem(record, storedItem, ownerId) {
    const catalogData = record.CatalogData || {}
    const mediaItems = catalogData.MediaItemsUnsorted || []
    const exemplar = mediaItems[0] || catalogData.MediaItem || {}
    const title = String(catalogData.Titel1 || '')
        .trim()
        .slice(0, MAX_NAME_LENGTH)

    return {
        externalId: storedItem.externalId || '',
        name: title || storedItem.name,
        description: buildDescription(catalogData, exemplar),
        categories: storedItem.categories,
        place: storedItem.place,
        externalUrl: storedItem.externalUrl,
        externalImgUrl: storedItem.externalImgUrl,
        status: statusFromMediaItems(mediaItems),
        owner: ownerId,
        trusteesOnly: false, // type-filler: not written on update (applyDiff writes only synced fields)
    }
}

/**
 * Re-fetches one stored WINBIAP item's catalogue record and re-maps name/description/status.
 * No catalogue hit ⇒ `gone` (archive); a transient fetch failure throws (the refresh flow
 * records it and leaves the item untouched).
 */
function refreshOne(institution, item) {
    const baseUrl = (institution && institution.baseUrl) || ''
    const result = fetchItemRecord(normalizeBaseUrl(baseUrl), item.externalId || '')
    if (!result.found) return { kind: 'gone' }
    return { kind: 'found', item: mapItem(result.record, item, institution.id) }
}

/** Refresh integration for WINBIAP WebOPAC items: re-maps name/description/status. Registered FIRST (specific). */
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
    fetchItemRecord,
    mapItem,
    buildDescription,
    formatGermanDate,
}
