/// <reference path="../../pb_data/types.d.ts" />

/**
 * CSV-import write path (#487 Phase 3). Shared logic behind the `/api/import/apply`,
 * `/api/import/preview`, and `/api/import/refresh` routes (integration_import.pb.js).
 *
 * The institution's CSV is parsed + mapped in the frontend; the mapped rows (WITHOUT `owner`) are
 * POSTed here. This reuses the existing sync/refresh port (`diff.js`, `db.js`, `refresh.js`) — no
 * new diff/write logic. The Owner is always the authenticated caller (`ownerId`), stamped onto
 * every row; any `owner` in the payload is IGNORED.
 *
 * Deliberately NO archive-guard (unlike the cron full-sync): the CSV upload is a user-confirmed,
 * authoritative full catalogue, so items absent from it are archived even beyond the 50% rate.
 */

const { makeSummary, errorMessage } = require(`${__hooks}/integrations/types.js`)
const { diffItems } = require(`${__hooks}/integrations/diff.js`)
const { loadExistingItems, applyDiff, findSyncConfigs } = require(`${__hooks}/integrations/db.js`)
const { getRefreshIntegrations, refreshInstitution } = require(`${__hooks}/integrations/refresh.js`)

/**
 * Validates the payload, stamps `owner = ownerId` on every row, and dedupes by `externalId`
 * keeping the LAST occurrence (there is no unique index on `items.externalId`, so a duplicated
 * externalId in one upload would otherwise create two rows). Owner from the payload is discarded.
 *
 * @returns {{ok: true, rows: Array}} on success, or {{ok: false, message: string}} for a 400
 *   (rows not an array, or a row missing a non-empty externalId — Q3 hard fail, defense-in-depth).
 */
function prepareRows(rows, ownerId) {
    if (!Array.isArray(rows)) {
        return { ok: false, message: 'Request body must contain a "rows" array.' }
    }
    const byExternalId = Object.create(null)
    const order = [] // first-appearance order (object key order is unreliable for numeric-looking ids)
    for (let i = 0; i < rows.length; i++) {
        const row = rows[i]
        const externalId = row && row.externalId
        if (!externalId || typeof externalId !== 'string') {
            return { ok: false, message: 'Row ' + i + ' is missing a non-empty externalId.' }
        }
        if (!(externalId in byExternalId)) order.push(externalId)
        // owner LAST → overwrites any owner supplied in the payload (never trusted).
        byExternalId[externalId] = Object.assign({}, row, { owner: ownerId })
    }
    return { ok: true, rows: order.map((id) => byExternalId[id]) }
}

/** Diffs prepared rows against the owner's existing external items (owner-scoped read, no write). */
function computeDiff(app, ownerId, preparedRows) {
    const existing = loadExistingItems(app, ownerId)
    return diffItems(preparedRows, existing)
}

/**
 * Applies prepared rows: diff → creates/updates/archives in ONE transaction (all-or-nothing).
 * Never throws — DB/write failures land in `summary.errors` (200 with a summary, like the cron).
 * @returns {object} a SyncSummary.
 */
function applyImport(app, ownerId, username, preparedRows) {
    const summary = makeSummary(username)
    const startTime = Date.now()
    summary.fetched = preparedRows.length
    try {
        const diff = computeDiff(app, ownerId, preparedRows)
        summary.skipped = diff.skipped
        // Owner-isolation: `existing` is owner-filtered, so a foreign externalId is unknown here and
        // becomes a Create with owner=ownerId — never a write to someone else's item. trusteesOnly:
        // Create takes it from the row; Update never touches it (applyDiff synced-fields projection).
        let writes = { created: 0, updated: 0, archived: 0 }
        app.runInTransaction((txApp) => {
            writes = applyDiff(txApp, diff)
        })
        summary.created = writes.created
        summary.updated = writes.updated
        summary.archived = writes.archived
    } catch (err) {
        summary.errors.push(errorMessage(err))
    } finally {
        summary.durationMs = Date.now() - startTime
    }
    return summary
}

/**
 * Preview (dryRun): computes the same diff as apply but WRITES NOTHING. Returns per-row actions,
 * the archive list, and counts, in a shape the import preview UI can render.
 * NOTE (§2.4): preview and apply diff against separate DB snapshots — preview is a forecast, not a
 * guarantee (unchanged from the pre-Phase-3 behaviour).
 * @returns {{summary: object, rowActions: Array, archiveRows: Array}}
 */
function previewImport(app, ownerId, preparedRows) {
    const diff = computeDiff(app, ownerId, preparedRows)

    const createIds = Object.create(null)
    for (let i = 0; i < diff.toCreate.length; i++) createIds[diff.toCreate[i].externalId] = true
    const updateIds = Object.create(null)
    for (let i = 0; i < diff.toUpdate.length; i++) updateIds[diff.toUpdate[i].data.externalId] = true

    const rowActions = preparedRows.map((r) => ({
        externalId: r.externalId,
        action: createIds[r.externalId] ? 'create' : updateIds[r.externalId] ? 'update' : 'skip',
    }))
    const archiveRows = diff.toArchive.map((i) => ({
        id: i.id,
        externalId: i.externalId || '',
        name: i.name,
    }))

    return {
        summary: {
            create: diff.toCreate.length,
            update: diff.toUpdate.length,
            archive: archiveRows.length,
            skip: diff.skipped,
        },
        rowActions: rowActions,
        archiveRows: archiveRows,
    }
}

/**
 * Refreshes ONLY the authenticated institution's own items (replaces the old frontend
 * `/api/refresh?institution=` call). Reuses the cron refresh port unchanged: discover the caller's
 * own `sync_config` rows and run `refreshInstitution` for each; aggregate into one SyncSummary.
 * Each config only claims its own item type (via `claimsInstitution`), so multiple configs don't
 * double-process an item.
 * @returns {object} a SyncSummary.
 */
function refreshOwn(app, ownerId, username) {
    const summary = makeSummary(username)
    const startTime = Date.now()
    try {
        // Discovery can throw (bad filter/DB) — keep the module's "always returns a summary"
        // contract (mirrors runRefresh, which also catches discovery failures).
        const institutions = findSyncConfigs(app, { institutionId: ownerId })
        const integrations = getRefreshIntegrations()
        for (let i = 0; i < institutions.length; i++) {
            const s = refreshInstitution(app, institutions[i], integrations)
            summary.fetched += s.fetched
            summary.created += s.created
            summary.updated += s.updated
            summary.archived += s.archived
            summary.skipped += s.skipped
            for (let j = 0; j < s.errors.length; j++) summary.errors.push(s.errors[j])
        }
    } catch (err) {
        summary.errors.push(errorMessage(err))
    } finally {
        summary.durationMs = Date.now() - startTime
    }
    return summary
}

module.exports = { prepareRows, applyImport, previewImport, refreshOwn }
