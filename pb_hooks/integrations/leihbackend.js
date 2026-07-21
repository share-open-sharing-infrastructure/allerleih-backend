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

/** Builds the per-item mapping context from an institution. */
function mappingContextFor(institution) {
    return {
        baseUrl: normalizeBaseUrl(institution.leihbackendUrl),
        ownerId: institution.id,
        city: institution.city,
        urlTemplate: institution.leihbackendItemUrlTemplate,
    }
}

/**
 * Re-fetches one stored item from leihbackend by its record id and re-maps all fields.
 * A 404 means the record is gone (→ archive); any other failure is transient (→ leave as-is).
 */
function refreshOne(institution, item) {
    const record = fetchItemById(normalizeBaseUrl(institution.leihbackendUrl || ''), item.externalId || '')
    if (!record) return { kind: 'gone' }
    return { kind: 'found', item: mapItem(record, mappingContextFor(institution)) }
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
    mapItem,
    stripHtml,
    mapCategory,
    normalizeBaseUrl,
    fetchItemById,
}
