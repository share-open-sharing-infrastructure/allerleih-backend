/// <reference path="../../pb_data/types.d.ts" />

/**
 * Shared value types + helpers for the integration refresh port (share-mvp#487 Phase 1).
 * Goja port of share-mvp `src/lib/server/integrations/core/types.ts` + parts of `core/sync.ts`.
 * ES5-ish synchronous JS (no TS, no npm); JSDoc typedefs stand in for the TS interfaces.
 *
 * NOTE (temporary double truth until Phase 3): `SYNCED_FIELDS` MUST stay byte-identical to the
 * TS twin in share-mvp `core/types.ts` (the frontend still runs its own copy for the CSV import).
 */

/**
 * Canonical list of the item fields an integration syncs. Single source of truth: the
 * change-detection comparison (`diffItems`) and the record projection (`loadExistingItems`)
 * both derive from this array. Byte-identical to the TS `SYNCED_FIELDS`.
 */
const SYNCED_FIELDS = [
    'name',
    'description',
    'status',
    'categories',
    'externalUrl',
    'externalImgUrl',
    'place',
]

/**
 * Returns a zeroed-out summary for one institution (or an error context).
 * @param {string} contextName - institution username, or an error-context label.
 * @param {string[]} [errors] - optional initial error messages.
 */
function makeSummary(contextName, errors) {
    return {
        institution: contextName,
        fetched: 0,
        created: 0,
        updated: 0,
        archived: 0,
        skipped: 0,
        errors: errors || [],
        durationMs: 0,
    }
}

/**
 * Extracts a human-readable message from a thrown value. Backend counterpart of the TS
 * `pbErrorMessage`: hook errors are Go/JS errors rather than PocketBase ClientResponseErrors,
 * so a plain `.message`/String() is enough.
 */
function errorMessage(err) {
    if (err && err.message) return String(err.message)
    return String(err)
}

module.exports = { SYNCED_FIELDS, makeSummary, errorMessage }
