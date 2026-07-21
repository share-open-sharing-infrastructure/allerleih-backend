/// <reference path="../../pb_data/types.d.ts" />

/**
 * Pure diff classification for the integration refresh port (share-mvp#487 Phase 1).
 * Goja port of share-mvp `core/diff.ts` + the `DESCRIPTION_PREFIX`/`archiveDescription`
 * pieces of `$lib/server/itemArchive.ts`. No I/O — operates on plain objects only.
 */

const { SYNCED_FIELDS } = require(`${__hooks}/integrations/types.js`)

/**
 * Prefix marking an item that is no longer present in a partner's source feed.
 * MUST stay byte-identical to the TS twin (`itemArchive.ts`): the "already archived" skip
 * below matches on this prefix, so any drift would re-archive the entire existing stock.
 */
const DESCRIPTION_PREFIX = '[Nicht mehr im Bestand] '

/** Prefixes a description to mark the item as archived, unless already prefixed. */
function archiveDescription(description) {
    const value = description == null ? '' : String(description)
    return value.indexOf(DESCRIPTION_PREFIX) === 0 ? value : DESCRIPTION_PREFIX + value
}

/**
 * True if `left` and `right` hold the same category strings (order-independent).
 * Treats a missing value as an empty list.
 */
function sameCategories(left, right) {
    const sortedLeft = (left || []).slice().sort()
    const sortedRight = (right || []).slice().sort()
    if (sortedLeft.length !== sortedRight.length) return false
    for (let i = 0; i < sortedLeft.length; i++) {
        if (sortedLeft[i] !== sortedRight[i]) return false
    }
    return true
}

/**
 * True if any synced field on `existingRecord` differs from `mappedItem`. Iterates
 * `SYNCED_FIELDS`; `categories` is compared order-independently via `sameCategories`.
 */
function hasChanged(existingRecord, mappedItem) {
    for (let i = 0; i < SYNCED_FIELDS.length; i++) {
        const field = SYNCED_FIELDS[i]
        if (field === 'categories') {
            if (!sameCategories(existingRecord.categories, mappedItem.categories)) return true
        } else if (existingRecord[field] !== mappedItem[field]) {
            return true
        }
    }
    return false
}

/**
 * Classifies `mappedItems` against `existingRecords` into create / update / archive / skip,
 * without any I/O. An item is skipped if unchanged, or already archived (status `unavailable`
 * + description prefixed by `DESCRIPTION_PREFIX`).
 *
 * @param {Array} mappedItems - items freshly produced by an integration's source mapping.
 * @param {Array} existingRecords - items currently stored for this institution.
 * @returns {{toCreate: Array, toUpdate: Array, toArchive: Array, skipped: number}}
 */
function diffItems(mappedItems, existingRecords) {
    // Object.create(null): externalId strings are keys — no prototype-name collisions.
    const existingByExternalId = Object.create(null)
    for (let i = 0; i < existingRecords.length; i++) {
        existingByExternalId[existingRecords[i].externalId] = existingRecords[i]
    }
    const externalIdsInSource = Object.create(null)
    for (let i = 0; i < mappedItems.length; i++) {
        externalIdsInSource[mappedItems[i].externalId] = true
    }

    const toCreate = []
    const toUpdate = []
    let skipped = 0

    for (let i = 0; i < mappedItems.length; i++) {
        const mappedItem = mappedItems[i]
        const existingRecord = existingByExternalId[mappedItem.externalId]
        if (!existingRecord) {
            toCreate.push(mappedItem)
        } else if (hasChanged(existingRecord, mappedItem)) {
            toUpdate.push({ id: existingRecord.id, data: mappedItem })
        } else {
            skipped += 1
        }
    }

    const toArchive = existingRecords.filter((record) => {
        // loadExistingItems only returns records with a non-empty externalId; the guard keeps
        // parity with the TS's optional-key handling.
        if (record.externalId && externalIdsInSource[record.externalId]) return false
        const alreadyArchived =
            record.status === 'unavailable' &&
            String(record.description || '').indexOf(DESCRIPTION_PREFIX) === 0
        if (alreadyArchived) {
            skipped += 1
            return false
        }
        return true
    })

    return { toCreate: toCreate, toUpdate: toUpdate, toArchive: toArchive, skipped: skipped }
}

module.exports = { DESCRIPTION_PREFIX, archiveDescription, sameCategories, hasChanged, diffItems }
