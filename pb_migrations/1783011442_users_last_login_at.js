/// <reference path="../pb_data/types.d.ts" />

// GDPR retention (issue #461): the platform never recorded when a user last logged
// in, so the "delete inactive accounts after 6 months" job had no field to key off.
// Add `lastLoginAt`, stamped (throttled) by the onRecordAuthRequest hook in
// account.pb.js. `retentionNotifiedAt` dedups the "deletion postponed (open loan)"
// skip notice so it isn't re-sent on every nightly run.
//
// Both fields are `hidden: true` — internal retention bookkeeping that must never be
// serialized through the API. The users collection is readable by any authenticated
// user (listRule/viewRule = `@request.auth.id != ""`), so a non-hidden lastLoginAt
// would leak every user's last-seen time to every other user. `hidden` still lets the
// jobs read the value via the superuser `$app` context.
//
// Existing rows are backfilled to their current `updated` value so they aren't all
// treated as inactive on day one.
migrate(
    (app) => {
        const c = app.findCollectionByNameOrId('users')
        c.fields.add(new Field({ type: 'date', name: 'lastLoginAt', hidden: true }))
        c.fields.add(new Field({ type: 'date', name: 'retentionNotifiedAt', hidden: true }))
        app.save(c)

        // Backfill via raw SQL so we don't bump every user's `updated` timestamp.
        app.db()
            .newQuery("UPDATE users SET lastLoginAt = updated WHERE lastLoginAt = '' OR lastLoginAt IS NULL")
            .execute()
    },
    (app) => {
        const c = app.findCollectionByNameOrId('users')
        for (const name of ['lastLoginAt', 'retentionNotifiedAt']) {
            const f = c.fields.getByName(name)
            if (f) c.fields.removeById(f.id)
        }
        app.save(c)
    }
)
