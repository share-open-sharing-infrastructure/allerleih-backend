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

/** Same format as now(), but `months` calendar months in the past. */
function monthsAgoIso(months) {
    // All-UTC so the cutoff is host-timezone-independent (output is UTC via toISOString).
    const d = new Date()
    const day = d.getUTCDate()
    // Anchor to the 1st before shifting the month so setUTCMonth can't roll over
    // (e.g. Mar 31 minus 1 month → Mar 3); then clamp back to a valid day.
    d.setUTCDate(1)
    d.setUTCMonth(d.getUTCMonth() - months)
    const lastDay = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate()
    d.setUTCDate(Math.min(day, lastDay))
    return d.toISOString().replace('T', ' ').slice(0, 19) + '.000Z'
}

/** Same format as now(), but `days` days in the past. */
function daysAgoIso(days) {
    const d = new Date()
    d.setDate(d.getDate() - days)
    return d.toISOString().replace('T', ' ').slice(0, 19) + '.000Z'
}

/** Shift a "YYYY-MM-DD HH:mm:ss.sssZ" string by `days` days (positive = future). */
function shiftDaysIso(iso, days) {
    // The space-separated PocketBase format is not portably Date-parseable; restore the 'T'.
    const d = new Date(iso.replace(' ', 'T'))
    d.setUTCDate(d.getUTCDate() + days)
    return d.toISOString().replace('T', ' ').slice(0, 19) + '.000Z'
}

/** Shift a "YYYY-MM-DD HH:mm:ss.sssZ" string `months` calendar months into the future. */
function monthsAfterIso(iso, months) {
    const d = new Date(iso.replace(' ', 'T'))
    const day = d.getUTCDate()
    // Same roll-over guard as monthsAgoIso: anchor to the 1st, then clamp the day.
    d.setUTCDate(1)
    d.setUTCMonth(d.getUTCMonth() + months)
    const lastDay = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate()
    d.setUTCDate(Math.min(day, lastDay))
    return d.toISOString().replace('T', ' ').slice(0, 19) + '.000Z'
}

/**
 * Classify a configured retention window and, when valid, resolve its cutoff.
 * Guards a destructive job against misconfiguration: only an explicit 0 disables it;
 * NaN (typo) or a negative value (which would resolve to a FUTURE cutoff and delete
 * everything) is rejected as invalid so the caller can refuse to run instead of
 * silently disabling or mass-deleting.
 *   unit: 'months' | 'days'
 *   returns { disabled: true } | { invalid: true } | { cutoff: '<iso>' }
 */
function retentionCutoff(window, unit) {
    if (window === 0) return { disabled: true }
    if (typeof window !== 'number' || isNaN(window) || window < 0) return { invalid: true }
    return { cutoff: unit === 'days' ? daysAgoIso(window) : monthsAgoIso(window) }
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
    monthsAgoIso,
    daysAgoIso,
    shiftDaysIso,
    monthsAfterIso,
    retentionCutoff,
    uniqueBy,
}
