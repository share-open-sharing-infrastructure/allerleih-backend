/// <reference path="../../pb_data/types.d.ts" />

/**
 * Shared utility functions.
 */

/**
 * Format a Date or ISO string to "YYYY-MM-DD HH:mm:ss" (UTC).
 */
function formatDateTime(dateOrString) {
    const d = typeof dateOrString === 'string' ? new Date(dateOrString) : dateOrString
    return d.toISOString().replace('T', ' ').replace(/\.\d+Z$/, 'Z')
}

/**
 * Get the current date/time as a PocketBase-compatible ISO string.
 */
function now() {
    return new Date().toISOString().replace('T', ' ').slice(0, 19) + '.000Z'
}

/**
 * Deduplicate an array of objects by a key function.
 */
function uniqueBy(arr, keyFn) {
    const seen = new Set()
    return arr.filter((item) => {
        const key = keyFn(item)
        if (seen.has(key)) return false
        seen.add(key)
        return true
    })
}

module.exports = {
    formatDateTime,
    now,
    uniqueBy,
}
