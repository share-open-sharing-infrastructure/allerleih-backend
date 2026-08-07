/// <reference path="../../pb_data/types.d.ts" />

// Email normalization helpers (Issue #557 / allerleih-backend#41).
//
// PocketBase matches emails case-sensitively and does NOT normalize on save, so a
// mixed-case registration (`Julika7@…`) produces an account that login/reset — which
// send the address the user actually types (lower-case) — can never reach. We defend
// against that at the data layer: the `users` create/update hooks (account.pb.js) call
// `normalizeEmail`, and the one-off backfill migration
// (pb_migrations/<ts>_normalize_user_emails_lowercase.js) calls `planEmailNormalization`
// to heal existing rows. Both `require()` this file, so the exact same logic runs in the
// hook, the migration and the unit tests — no drift.

/**
 * Trim + lower-case an email. Defensive against non-string / null input.
 * @param {unknown} raw
 * @returns {string} the normalized address ('' for blank/nullish input)
 */
function normalizeEmail(raw) {
    // Assumes ASCII local-parts (the overwhelming real-world case). For IDN/Unicode
    // local-parts with locale-sensitive casing, PocketBase-goja (backend) and V8
    // (frontend, src/lib/server/email.ts) could in theory diverge — so the SAME
    // normalization must hold on both sides, and the migration's collision check only
    // ever compares this JS-computed form.
    return String(raw ?? '')
        .trim()
        .toLowerCase()
}

/**
 * Plan a case-normalization pass over a set of email-bearing rows.
 *
 * Groups the rows by their normalized (trim+lowercase) email. A group with more than
 * one member is a **case-collision** (e.g. `Foo@x.de` + `foo@x.de`): normalizing them
 * would collapse two distinct accounts onto the same address and violate the users
 * unique-email index, so the whole group is reported as a collision and left untouched
 * for manual resolution. A lone row is safe to normalize, and only reported when its
 * stored email differs from the normalized form. Blank emails are ignored (nothing to
 * normalize, and they must not manufacture a spurious collision group).
 *
 * Pure and side-effect free so the migration's destructive loop is unit-testable.
 *
 * @param {Array<{ id: string, email: unknown }>} rows
 * @returns {{
 *   updates: Array<{ id: string, from: string, to: string }>,
 *   collisions: Array<{ normalized: string, ids: string[] }>,
 * }}
 */
function planEmailNormalization(rows) {
    const groups = new Map() // normalized -> [{ id, email }]
    for (const row of rows) {
        const normalized = normalizeEmail(row.email)
        if (!normalized) continue // blank — nothing to normalize
        if (!groups.has(normalized)) groups.set(normalized, [])
        groups.get(normalized).push({ id: row.id, email: String(row.email) })
    }

    const updates = []
    const collisions = []
    for (const [normalized, members] of groups) {
        if (members.length > 1) {
            collisions.push({ normalized, ids: members.map((m) => m.id) })
            continue
        }
        const only = members[0]
        if (only.email !== normalized) {
            updates.push({ id: only.id, from: only.email, to: normalized })
        }
    }
    return { updates, collisions }
}

module.exports = { normalizeEmail, planEmailNormalization }
