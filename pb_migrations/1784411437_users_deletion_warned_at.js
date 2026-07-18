/// <reference path="../pb_data/types.d.ts" />

// Inactivity-deletion warning: `deletionWarnedAt` records when the "your account
// will be deleted on <date>" advance-warning email was last sent, so the nightly
// warning job (retention.pb.js) sends it at most once per inactivity cycle. A
// warning stamp older than the user's `lastLoginAt` belongs to a previous cycle —
// logging in implicitly re-arms the warning without any auth-hook change.
// (`retentionNotifiedAt` is already used by the open-loan skip notice.)
//
// `hidden: true` like the other retention fields: the users collection is readable
// by any authenticated user, so the field must never serialize through the API;
// the jobs read it via the superuser `$app` context. No backfill — empty means
// "never warned".
migrate(
    (app) => {
        const c = app.findCollectionByNameOrId('users')
        c.fields.add(new Field({ type: 'date', name: 'deletionWarnedAt', hidden: true }))
        app.save(c)
    },
    (app) => {
        const c = app.findCollectionByNameOrId('users')
        const f = c.fields.getByName('deletionWarnedAt')
        if (f) c.fields.removeById(f.id)
        app.save(c)
    }
)
