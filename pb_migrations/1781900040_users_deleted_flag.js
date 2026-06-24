/// <reference path="../pb_data/types.d.ts" />

// Account deletion (phase 1 — "deactivate"): add a `deleted` flag + `deletedAt`
// timestamp to users. On self-service deletion the row is anonymized in place and
// `deleted` is set; the onRecordAuthRequest hook (account.pb.js) then blocks login,
// and the app masks the username to "Gelöschtes Konto". `deleted` is also exposed
// on the public users_public view so the public profile page can mask the name.
// A future purge job (phase 2) uses `deletedAt` to finally remove the row.
migrate(
    (app) => {
        const c = app.findCollectionByNameOrId('users')
        c.fields.add(new Field({ type: 'bool', name: 'deleted' }))
        c.fields.add(new Field({ type: 'date', name: 'deletedAt' }))
        app.save(c)

        const v = app.findCollectionByNameOrId('users_public')
        v.viewQuery =
            'SELECT\n  users.id,\n  users.username,\n  users.bio,\n  users.verified,\n  users.isInstitution,\n  users.profileImage,\n  users.deleted,\n  users.created\nFROM users'
        app.save(v)
    },
    (app) => {
        const v = app.findCollectionByNameOrId('users_public')
        v.viewQuery =
            'SELECT\n  users.id,\n  users.username,\n  users.bio,\n  users.verified,\n  users.isInstitution,\n  users.profileImage,\n  users.created\nFROM users'
        app.save(v)

        const c = app.findCollectionByNameOrId('users')
        for (const name of ['deleted', 'deletedAt']) {
            const f = c.fields.getByName(name)
            if (f) c.fields.removeById(f.id)
        }
        app.save(c)
    }
)
