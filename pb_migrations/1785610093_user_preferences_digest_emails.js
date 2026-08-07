/// <reference path="../pb_data/types.d.ts" />

// #607: own opt-out for the weekly digest, so the one-click unsubscribe link in the digest
// (services/unsubscribe.js) can turn OFF the digest without also silencing transactional mail
// ("new message", lending requests) — which emailNotifications alone controls.
//
// Backfill is mandatory: PocketBase bool columns default to `false` for an omitted value on
// create (confirmed empirically — #607 spike S1), so every EXISTING user_preferences row would
// otherwise read as "digest unsubscribed" the moment this column appears — the opposite of the
// documented default (opted in). This is exactly the trap 1783600001 already warns about for
// emailNotifications; digestEmails needs the same treatment.
//
// No view touches user_preferences (it's owner-only, never exposed through a *_public view), so
// there is no masking-view update required here.
migrate(
    (app) => {
        const c = app.findCollectionByNameOrId('pbc_2847563901') // user_preferences
        c.fields.add(new Field({ type: 'bool', name: 'digestEmails' }))
        app.save(c)
        app.db().newQuery('UPDATE user_preferences SET digestEmails = true').execute()
    },
    (app) => {
        const c = app.findCollectionByNameOrId('pbc_2847563901')
        const f = c.fields.getByName('digestEmails')
        if (f) c.fields.removeById(f.id)
        return app.save(c)
    }
)
