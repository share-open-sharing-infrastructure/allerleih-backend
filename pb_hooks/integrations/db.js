/// <reference path="../../pb_data/types.d.ts" />

/**
 * PocketBase data-layer for the integration refresh port (share-mvp#487 Phase 1).
 * Goja port of share-mvp `core/pocketbase.ts` (loadExistingItems, findSyncInstitutions) and
 * `core/write.ts` (applyDiff). The TS superuser-client cache, 401 re-auth wrapper, HTTP batching,
 * inter-batch pauses and per-batch error accumulation are ALL dropped: hooks use native `$app`
 * (elevated, no rate limits) and write inside a per-institution transaction (all-or-nothing).
 *
 * Filters use `{:param}` placeholders exclusively — never string interpolation.
 */

const { SYNCED_FIELDS } = require(`${__hooks}/integrations/types.js`)
const { archiveDescription } = require(`${__hooks}/integrations/diff.js`)

/** Records per page when loading an institution's stored items. */
const PAGE = 200

/** Projects a stored `items` record to the plain object the pure diff works on. */
function recordToExisting(record) {
    return {
        id: record.id,
        externalId: record.getString('externalId'),
        name: record.getString('name'),
        description: record.getString('description'),
        status: record.getString('status'),
        // Select-multiple → JS string array (the pure diff compares it order-independently).
        categories: record.getStringSlice('categories'),
        externalUrl: record.getString('externalUrl'),
        externalImgUrl: record.getString('externalImgUrl'),
        place: record.getString('place'),
    }
}

/**
 * Loads all externally-synced items owned by an institution (paginated), projected to the
 * fields the diff/archive logic needs.
 *
 * @param {any} app - `$app` or a transaction app.
 * @param {string} ownerId - `users` record id of the owning institution.
 * @returns {Array} plain `ExistingItem` objects.
 */
function loadExistingItems(app, ownerId) {
    const out = []
    let offset = 0
    for (;;) {
        const batch = app.findRecordsByFilter(
            'items',
            'owner = {:owner} && externalId != ""',
            '',
            PAGE,
            offset,
            { owner: ownerId }
        )
        for (let i = 0; i < batch.length; i++) out.push(recordToExisting(batch[i]))
        if (batch.length < PAGE) break
        offset += PAGE
    }
    return out
}

/**
 * Finds institutions configured for source sync: `isInstitution = true` with a non-empty
 * base URL. Optionally restricted to one id. Interim discovery on the overloaded
 * `leihbackendUrl` (replaced by a dedicated `sync_config` collection in Phase 2).
 *
 * @param {any} app - `$app` or a transaction app.
 * @param {string} [institutionId] - restrict to this single institution id.
 * @returns {Array} plain `SyncInstitution` objects (empty if the id is given but not found).
 */
function findSyncInstitutions(app, institutionId) {
    let filter = 'isInstitution = true && leihbackendUrl != ""'
    let params = {}
    if (institutionId) {
        filter += ' && id = {:id}'
        params = { id: institutionId }
    }
    // Institutions are few — one generous page suffices (no source has thousands of accounts).
    const records = app.findRecordsByFilter('users', filter, '', 500, 0, params)
    return records.map((record) => ({
        id: record.id,
        username: record.getString('username'),
        city: record.getString('city'),
        leihbackendUrl: record.getString('leihbackendUrl'),
        leihbackendItemUrlTemplate: record.getString('leihbackendItemUrlTemplate'),
    }))
}

/**
 * Applies a `DiffResult` via direct record writes: updates, then creates, then archives.
 * MUST run inside `app.runInTransaction` — a failed write throws and rolls the whole
 * institution back (all-or-nothing), instead of the TS's "failed batch recorded" behavior.
 *
 * Updates write ONLY the synced fields (`syncedFieldsOf` semantics): `owner` and `trusteesOnly`
 * are never touched, so a status refresh can't reset institution-curated visibility. Creates
 * write the full item.
 *
 * @param {any} txApp - the transaction app from `runInTransaction`.
 * @param {{toCreate: Array, toUpdate: Array, toArchive: Array}} diff
 * @returns {{created: number, updated: number, archived: number}}
 */
function applyDiff(txApp, diff) {
    const itemsCollection = txApp.findCollectionByNameOrId('items')
    let created = 0
    let updated = 0
    let archived = 0

    for (let i = 0; i < diff.toUpdate.length; i++) {
        const entry = diff.toUpdate[i]
        const record = txApp.findRecordById('items', entry.id)
        for (let f = 0; f < SYNCED_FIELDS.length; f++) {
            record.set(SYNCED_FIELDS[f], entry.data[SYNCED_FIELDS[f]])
        }
        txApp.save(record)
        updated += 1
    }

    for (let i = 0; i < diff.toCreate.length; i++) {
        const item = diff.toCreate[i]
        const record = new Record(itemsCollection)
        for (let f = 0; f < SYNCED_FIELDS.length; f++) {
            record.set(SYNCED_FIELDS[f], item[SYNCED_FIELDS[f]])
        }
        record.set('externalId', item.externalId)
        record.set('owner', item.owner)
        record.set('trusteesOnly', item.trusteesOnly)
        txApp.save(record)
        created += 1
    }

    for (let i = 0; i < diff.toArchive.length; i++) {
        const existing = diff.toArchive[i]
        const record = txApp.findRecordById('items', existing.id)
        record.set('status', 'unavailable')
        record.set('description', archiveDescription(existing.description))
        txApp.save(record)
        archived += 1
    }

    return { created: created, updated: updated, archived: archived }
}

module.exports = { loadExistingItems, findSyncInstitutions, applyDiff }
