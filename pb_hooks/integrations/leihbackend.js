/// <reference path="../../pb_data/types.d.ts" />

/**
 * leihbackend refresh integration + item mapping. Goja port of share-mvp
 * `leihbackend/client.ts` (fetchItemById) and `leihbackend/mapping.ts` (full mapItem — the
 * refresh re-maps every field, not just status). Also carries the catch-all claims logic.
 *
 * $http.send notes (spike share-mvp#487 §4.4): `timeout` is in SECONDS; 404 ⇒ record gone
 * (archive); any other non-2xx / network error ⇒ transient (throw, leave item untouched).
 */

const { assertPublicHttpUrl } = require(`${__hooks}/integrations/urlGuard.js`)
const { INTEGRATION_ALLOW_INSECURE_URL } = require(`${__hooks}/constants.js`)
const { isWinbiapInstitution } = require(`${__hooks}/integrations/winbiap.js`)

const TIMEOUT_SECONDS = 15

const MAX_DESCRIPTION_LENGTH = 4000
const MAX_NAME_LENGTH = 200
const MAX_CATEGORIES = 3

/** Strips trailing slashes from a leihbackend base URL. */
function normalizeBaseUrl(url) {
    return String(url || '').replace(/\/+$/, '')
}

const BLOCK_TAG_REGEX = /<\/?(p|div|li)>|<br\s*\/?>/gi
const TAG_REGEX = /<[^>]+>/g

const HTML_ENTITIES = {
    '&amp;': '&',
    '&lt;': '<',
    '&gt;': '>',
    '&quot;': '"',
    '&apos;': "'",
    '&#39;': "'",
    '&nbsp;': ' ',
}

/**
 * Strips HTML tags from a leihbackend item description, decoding entities and preserving
 * paragraph breaks. Regex-based on purpose (output is rendered as plain text).
 */
function stripHtml(html) {
    if (!html) return ''

    let text = html.replace(BLOCK_TAG_REGEX, '\n')
    text = text.replace(TAG_REGEX, '')

    // Decode entities after tag stripping, so encoded "<"/">" are not mistaken for tags.
    text = text.replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    text = text.replace(/&[a-zA-Z]+;/g, (entity) => (HTML_ENTITIES[entity] !== undefined ? HTML_ENTITIES[entity] : entity))

    text = text.replace(/[ \t]+/g, ' ')
    text = text
        .split('\n')
        .map((line) => line.trim())
        .join('\n')
    text = text.replace(/\n{3,}/g, '\n\n')

    return text.trim()
}

/**
 * Direct mapping from leihbackend's fixed category enum to AllerLeih's category list.
 * Unmapped values fall back to 'Sonstiges'. MUST match the TS twin.
 */
const CATEGORY_MAP = {
    freizeit: 'Freizeit und Sport',
    garten: 'Werkzeug und Garten',
    haushalt: 'Sonstiges',
    heimwerken: 'Werkzeug und Garten',
    kinder: 'Für Kinder',
    küche: 'Küche',
    sonstige: 'Sonstiges',
}

/** Maps leihbackend category tags to AllerLeih's fixed list, falling back to 'Sonstiges'. */
function mapCategory(categories) {
    const list = categories || []
    const seen = Object.create(null)
    const mapped = []
    for (let i = 0; i < list.length && mapped.length < MAX_CATEGORIES; i++) {
        const key = String(list[i]).toLowerCase().trim()
        // hasOwnProperty guard: avoid inherited Object members (e.g. "toString") being treated as a mapping.
        const target = Object.prototype.hasOwnProperty.call(CATEGORY_MAP, key) ? CATEGORY_MAP[key] : undefined
        if (target !== undefined && !seen[target]) {
            seen[target] = true
            mapped.push(target)
        }
    }
    return mapped.length > 0 ? mapped : ['Sonstiges']
}

function buildDescription(src) {
    const base = stripHtml(src.description || '')

    const extraLines = []
    if (src.iid !== undefined && src.iid !== null) extraLines.push('Inventarnummer: ' + src.iid)
    if (src.brand && String(src.brand).trim()) extraLines.push('Marke: ' + String(src.brand).trim())
    if (src.model && String(src.model).trim()) extraLines.push('Modell: ' + String(src.model).trim())
    if (src.parts > 1) extraLines.push('Teile: ' + src.parts)
    if (src.deposit > 0) extraLines.push('Kaution: ' + src.deposit + ' €')

    const extra = extraLines.join('\n')
    const full = base ? (extra ? base + '\n\n' + extra : base) : extra

    return full.slice(0, MAX_DESCRIPTION_LENGTH)
}

function buildExternalUrl(src, template) {
    if (!template) return ''
    return template.replace(/\{id\}/g, src.id).replace(/\{iid\}/g, String(src.iid))
}

/** Builds the item's cover image URL from its first image, or '' if it has none. */
function buildImageUrl(src, baseUrl) {
    const firstImage = src.images && src.images[0]
    if (!firstImage) return ''
    return baseUrl + '/api/files/item/' + src.id + '/' + firstImage
}

/** Maps a single `item_public` record to AllerLeih `items` fields, per spec §3.1. */
function mapItem(leihbackendItem, itemContext) {
    return {
        externalId: leihbackendItem.id,
        name: String(leihbackendItem.name || '').trim().slice(0, MAX_NAME_LENGTH),
        description: buildDescription(leihbackendItem),
        status: leihbackendItem.status === 'instock' ? 'available' : 'unavailable',
        categories: mapCategory(leihbackendItem.category),
        externalImgUrl: buildImageUrl(leihbackendItem, itemContext.baseUrl),
        externalUrl: buildExternalUrl(leihbackendItem, itemContext.urlTemplate),
        place: itemContext.city || '',
        owner: itemContext.ownerId,
        trusteesOnly: false,
    }
}

/**
 * Fetches a single `item_public` record by its leihbackend id.
 * @returns the parsed record, or `null` if it no longer exists (HTTP 404).
 * @throws on any other non-2xx response, network error, or timeout (transient).
 */
function fetchItemById(baseUrl, id) {
    const base = normalizeBaseUrl(baseUrl)
    assertPublicHttpUrl(base, INTEGRATION_ALLOW_INSECURE_URL)
    const url = base + '/api/collections/item_public/records/' + encodeURIComponent(id)

    let response
    try {
        response = $http.send({ url: url, method: 'GET', timeout: TIMEOUT_SECONDS })
    } catch (err) {
        throw new Error('Request to ' + url + ' failed: ' + String(err))
    }

    if (response.statusCode === 404) return null
    if (response.statusCode < 200 || response.statusCode >= 300) {
        throw new Error('Unexpected status ' + response.statusCode + ' from ' + url)
    }

    let body
    try {
        body = response.json
    } catch (err) {
        body = null
    }
    if (!body) throw new Error('Empty/invalid body from ' + url)
    return body
}

/**
 * Builds the per-item mapping context from an institution. As of #487 Phase 2 the institution
 * comes from `sync_config`, so it carries `baseUrl`/`itemUrlTemplate` (was `leihbackendUrl`/
 * `leihbackendItemUrlTemplate`). `ownerId` stays the institution user id.
 */
function mappingContextFor(institution) {
    return {
        baseUrl: normalizeBaseUrl(institution.baseUrl),
        ownerId: institution.id,
        city: institution.city,
        urlTemplate: institution.itemUrlTemplate,
    }
}

/**
 * Re-fetches one stored item from leihbackend by its record id and re-maps all fields.
 * A 404 means the record is gone (→ archive); any other failure is transient (→ leave as-is).
 */
function refreshOne(institution, item) {
    const record = fetchItemById(normalizeBaseUrl(institution.baseUrl || ''), item.externalId || '')
    if (!record) return { kind: 'gone' }
    return { kind: 'found', item: mapItem(record, mappingContextFor(institution)) }
}

// --- Full-catalogue pull (#487 Phase 2) ---------------------------------------------------

const PER_PAGE = 200
const MAX_ITEMS = 5000
// A source reporting an absurd `totalPages` must not drive endless sequential GETs.
const MAX_PAGES = Math.ceil(MAX_ITEMS / PER_PAGE) + 1 // 26

/**
 * Pages through `{base}/api/collections/item_public/records` until exhausted, returning every raw
 * record. Port of the frontend `fetchAllItems`.
 *
 * **Truncated-feed guard (critical):** any fetch error / non-2xx throws, `items.length > MAX_ITEMS`
 * throws, and `totalPages > MAX_PAGES` throws — a silently truncated feed would wrongly archive the
 * tail, so an incomplete answer is treated as a fetch FAILURE (zero writes), never a partial result.
 * An empty page ends the loop regardless of the claimed `totalPages`.
 *
 * Redirect residual as in Phase 1: `$http.send` follows redirects; a redirect landing on a non-feed
 * page yields a body without an `items` array → treated as a fetch error here.
 *
 * @throws on any fetch/parse/cap failure — the caller aborts the institution with zero writes.
 */
function fetchAllItems(baseUrl) {
    const base = normalizeBaseUrl(baseUrl)
    assertPublicHttpUrl(base, INTEGRATION_ALLOW_INSECURE_URL)

    const items = []
    let page = 1
    let totalPages = 1

    do {
        const url = base + '/api/collections/item_public/records?page=' + page + '&perPage=' + PER_PAGE

        let response
        try {
            response = $http.send({ url: url, method: 'GET', timeout: TIMEOUT_SECONDS })
        } catch (err) {
            throw new Error('Request to ' + url + ' failed: ' + String(err))
        }
        if (response.statusCode < 200 || response.statusCode >= 300) {
            throw new Error('Unexpected status ' + response.statusCode + ' from ' + url)
        }

        let data
        try {
            data = response.json
        } catch (err) {
            data = null
        }
        if (!data || !Array.isArray(data.items)) {
            throw new Error('Invalid feed body from ' + url)
        }

        for (let i = 0; i < data.items.length; i++) items.push(data.items[i])

        if (items.length > MAX_ITEMS) {
            throw new Error(base + ' returned more than ' + MAX_ITEMS + ' items')
        }
        // A page count beyond the item cap means a runaway/lying source.
        if (data.totalPages > MAX_PAGES) {
            throw new Error(base + ' reports ' + data.totalPages + ' pages (max ' + MAX_PAGES + ')')
        }
        // An empty page means the feed is exhausted regardless of the claimed totalPages.
        if (data.items.length === 0) break

        totalPages = data.totalPages
        page += 1
    } while (page <= totalPages)

    return items
}

/**
 * Fetches an institution's full leihbackend catalogue and maps it to AllerLeih item shape.
 * Port of the frontend `fetchAndMapItems`: throws on fetch failure (institution then aborts with
 * zero writes), and drops records with an empty/missing name (one bad source record must not
 * crash or pollute the whole institution's sync). Counts-only log for the dropped ones.
 *
 * @param {object} institution - a `sync_config`-derived institution (carries `baseUrl` etc.).
 * @returns {Array} mapped items ready for the diff.
 */
function fetchAndMapItems(institution) {
    const context = mappingContextFor(institution)
    const remoteFeed = fetchAllItems(context.baseUrl)

    const mapped = []
    let skippedNameless = 0
    for (let i = 0; i < remoteFeed.length; i++) {
        const item = mapItem(remoteFeed[i], context)
        if (item.name !== '') {
            mapped.push(item)
        } else {
            skippedNameless += 1
        }
    }
    if (skippedNameless > 0) {
        $app.logger().warn(
            '[cron:sync] skipped nameless source records',
            'institution', institution.username,
            'count', skippedNameless
        )
    }
    return mapped
}

/** Full-pull integration for leihbackend instances (registered in sync.js's getPullIntegrations). */
const leihbackendPullIntegration = {
    id: 'leihbackend',
    fetchAndMap: fetchAndMapItems,
}

/**
 * Refresh integration for leihbackend. Within a leihbackend institution it claims every item
 * (catch-all) — but never items of a WINBIAP institution, where a catch-all would 404 against
 * `item_public` and wrongly archive them. Registered LAST (see refresh.js).
 */
const leihbackendRefreshIntegration = {
    id: 'leihbackend',
    claimsInstitution: (institution) => !isWinbiapInstitution(institution),
    claimsItem: () => true,
    fetchOne: refreshOne,
}

module.exports = {
    leihbackendRefreshIntegration,
    leihbackendPullIntegration,
    mapItem,
    stripHtml,
    mapCategory,
    normalizeBaseUrl,
    fetchItemById,
    fetchAllItems,
    fetchAndMapItems,
}
