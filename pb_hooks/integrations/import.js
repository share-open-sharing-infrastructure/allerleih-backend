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
const { acquireRunLock, releaseRunLock } = require(`${__hooks}/integrations/lock.js`)

/**
 * Upper bound on rows per request, mirroring the frontend parser's MAX_ROWS. The endpoint is
 * reachable by any institutional account, so the limit has to live HERE too — the frontend's
 * 5 000-row / 1 MB check only bounds the polite path, not a hand-rolled POST.
 */
const MAX_IMPORT_ROWS = 5000

/** 409 body for a writing import step that lost the race for the shared lock (see withRunLock). */
const BUSY_MESSAGE =
    'Another integration run (sync, refresh or import) is currently active. Please try again in a few minutes.'

/**
 * Validates the payload, stamps `owner = ownerId` on every row, and dedupes by `externalId`
 * keeping the LAST occurrence (there is no unique index on `items.externalId`, so a duplicated
 * externalId in one upload would otherwise create two rows). Owner from the payload is discarded.
 *
 * @returns {{ok: true, rows: Array}} on success, or {{ok: false, message: string}} for a 400
 *   (rows not an array, too many rows, or a row missing a non-empty externalId — Q3 hard fail,
 *   defense-in-depth).
 */
function prepareRows(rows, ownerId) {
    if (!Array.isArray(rows)) {
        return { ok: false, message: 'Request body must contain a "rows" array.' }
    }
    if (rows.length > MAX_IMPORT_ROWS) {
        return {
            ok: false,
            message: 'Too many rows: ' + rows.length + ' (max ' + MAX_IMPORT_ROWS + ' per request).',
        }
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
 * Each config only claims its own items (`claimsInstitution` at institution level, `claimsItem` at
 * item level), so multiple configs never double-process or cross-archive an item.
 *
 * `configured: false` means the institution has no `sync_config` row at all — there is nothing this
 * button can do, and the caller must say so instead of reporting a successful no-op.
 *
 * @returns {object} a SyncSummary plus `configured`.
 */
function refreshOwn(app, ownerId, username) {
    const summary = makeSummary(username)
    summary.configured = false
    const startTime = Date.now()
    try {
        // Discovery can throw (bad filter/DB) — keep the module's "always returns a summary"
        // contract (mirrors runRefresh, which also catches discovery failures).
        const institutions = findSyncConfigs(app, { institutionId: ownerId })
        summary.configured = institutions.length > 0
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

/**
 * Runs a WRITING import step under the integration-wide overlap lock (`integrations/lock.js`) —
 * the same lock the sync/refresh crons hold. Without it a cron sync could compute its diff while
 * an apply is writing and then archive the freshly created items, two concurrent applies could
 * create the same `externalId` twice (no unique index), and a double-clicked refresh button would
 * fire N parallel WebOPAC crawls.
 *
 * Preview needs no lock: it writes nothing and is explicitly a forecast, not a guarantee.
 *
 * @param {any} app - `$app`.
 * @param {() => object} run - the write step; its return value is passed through.
 * @returns {object|null} whatever `run` returned, or `null` when another run holds the lock.
 */
function withRunLock(app, run) {
    if (!acquireRunLock(app, 'import')) return null
    try {
        return run()
    } finally {
        releaseRunLock(app)
    }
}

module.exports = { prepareRows, applyImport, previewImport, refreshOwn, withRunLock, MAX_IMPORT_ROWS, BUSY_MESSAGE }
