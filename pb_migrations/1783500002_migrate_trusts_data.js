/// <reference path="../pb_data/types.d.ts" />

// Copy every users.trusts[] entry into a `trusts` join row (truster = the user,
// trustee = each id in their list). Idempotent: skips self-references and rows
// that already exist. Runs after the collection is created and before the field
// is dropped. Per-edge failures (e.g. a dangling trustee id) are skipped, never
// fatal, so one bad edge can't abort the whole one-shot copy.
//
// NOTE: the test harness applies migrations to an EMPTY users table, so this copy
// loop is not exercised by `npm test` — its correctness rests on this code + the
// idempotency/robustness guards below.
migrate(
    (app) => {
        const col = app.findCollectionByNameOrId('pbc_trusts00001')
        const users = app.findAllRecords('users')
        for (const u of users) {
            const trusted = u.get('trusts') || []
            for (const tid of trusted) {
                if (!tid || tid === u.id) continue // skip empty + self-trust
                try {
                    app.findFirstRecordByFilter('trusts', 'truster = {:t} && trustee = {:e}', { t: u.id, e: tid })
                    continue // already migrated
                } catch (_) {
                    // not present yet — create it
                }
                try {
                    const rec = new Record(col)
                    rec.set('truster', u.id)
                    rec.set('trustee', tid)
                    app.save(rec)
                } catch (err) {
                    // A dangling/invalid trustee id must not abort the whole copy — skip it.
                    try {
                        app.logger().warn('trusts data migration: skipped invalid edge', 'truster', u.id, 'trustee', tid)
                    } catch (_) {
                        /* logging is best-effort */
                    }
                }
            }
        }
    },
    (app) => {
        // down: remove all copied rows (the users.trusts field still holds the source data).
        const rows = app.findAllRecords('trusts')
        for (const r of rows) app.delete(r)
    }
)
