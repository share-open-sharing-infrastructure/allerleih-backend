/// <reference path="../pb_data/types.d.ts" />
migrate(
    (app) => {
        const c = app.findCollectionByNameOrId('conversations')
        // requester must be the caller, and the item must be public, owned by the
        // caller, or one whose owner trusts the caller
        c.createRule =
            '@request.auth.id != "" && @request.auth.id = requester && (requestedItem.trusteesOnly = false || requestedItem.owner = @request.auth.id || requestedItem.owner.trusts.id ?= @request.auth.id)'
        app.save(c)
    },
    (app) => {
        const c = app.findCollectionByNameOrId('conversations')
        c.createRule = '@request.auth.id != ""'
        app.save(c)
    }
)
