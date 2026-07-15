/// <reference path="../pb_data/types.d.ts" />

// Issue #426 step 2 of 3: copy `preferredTransportMode` + `hasOnboarded` from users
// into `user_preferences`. Unlike the geolocation/contacts copies, this MUST merge:
// a prefs row may already exist (NotificationSettings.svelte creates one on the first
// email-notification toggle), so we update it in place instead of skipping it — never
// `continue` on an existing row, or those users lose their two migrated values.
//
// NOTE on testing: like the #424 trusts copy (1783500002), this data-copy loop is NOT
// exercised by `npm test` — the harness (tests/harness.mjs) applies migrations to an
// EMPTY database before any user exists, so `findAllRecords('users')` yields nothing.
// The merge/create semantics below are covered indirectly by the frontend helper tests
// and reviewed by hand; verify against real data on staging before a prod run.
migrate(
    (app) => {
        const col = app.findCollectionByNameOrId('user_preferences')
        const users = app.findAllRecords('users')
        for (const u of users) {
            const tm = u.get('preferredTransportMode')
            const ob = !!u.get('hasOnboarded')
            if (!tm && !ob) continue // nothing worth migrating (default state)

            let rec
            let isNew = false
            try {
                rec = app.findFirstRecordByFilter('user_preferences', 'user = {:u}', { u: u.id })
            } catch (_) {
                rec = new Record(col)
                rec.set('user', u.id)
                isNew = true
            }
            // CRITICAL: emailNotifications is an opt-OUT model — "no row" means opted IN.
            // A freshly-created row must default it to true, or every onboarded user
            // without a prior prefs row (i.e. most of the base) would be silently opted
            // OUT of all email. Only set it when creating, so an existing explicit
            // `false` on a merged row is preserved.
            if (isNew) rec.set('emailNotifications', true)
            if (tm) rec.set('preferredTransportMode', tm)
            rec.set('hasOnboarded', ob)
            app.save(rec)
        }
    },
    (app) => {
        // down: copy the two values back onto users. Down-migrations run in reverse,
        // so 1783600002.down has already re-added the users columns and 1783600000.down
        // has not yet removed the prefs columns — both exist here.
        const prefs = app.findAllRecords('user_preferences')
        for (const p of prefs) {
            const uid = p.get('user')
            if (!uid) continue
            let u
            try {
                u = app.findRecordById('users', uid)
            } catch (_) {
                continue // user gone — nothing to restore
            }
            const tm = p.get('preferredTransportMode')
            if (tm) u.set('preferredTransportMode', tm)
            u.set('hasOnboarded', !!p.get('hasOnboarded'))
            app.save(u)
        }
    }
)
