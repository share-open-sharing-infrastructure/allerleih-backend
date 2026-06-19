/// <reference path="../pb_data/types.d.ts" />

// Enforce trust on the base items collection: a user may read a trustees-only
// item's full record only if it's public, they own it, or its owner trusts
// them. Previously any logged-in user could read every trustees item here.
// (Guests already got nothing — the rule still requires auth.)
migrate(
    (app) => {
        const c = app.findCollectionByNameOrId('items')
        const rule =
            '@request.auth.id != "" && (trusteesOnly = false || @request.auth.id = owner || owner.trusts.id ?= @request.auth.id)'
        c.listRule = rule
        c.viewRule = rule
        app.save(c)
    },
    (app) => {
        const c = app.findCollectionByNameOrId('items')
        c.listRule = '@request.auth.id != ""'
        c.viewRule = '@request.auth.id != ""'
        app.save(c)
    }
)
