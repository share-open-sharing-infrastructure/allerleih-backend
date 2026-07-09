/// <reference path="../pb_data/types.d.ts" />
// Defense in depth for the lending-requirements gate: bind itemOwner to the item's
// real owner at the rule layer so a forged itemOwner is rejected even if the hook
// changes. The hook (lending_requirements.pb.js) is the primary guard.
migrate(
    (app) => {
        const c = app.findCollectionByNameOrId('conversations')
        c.createRule =
            '@request.auth.id != "" && @request.auth.id = requester && itemOwner = requestedItem.owner && (requestedItem.trusteesOnly = false || requestedItem.owner = @request.auth.id || requestedItem.owner.trusts.id ?= @request.auth.id)'
        app.save(c)
    },
    (app) => {
        const c = app.findCollectionByNameOrId('conversations')
        c.createRule =
            '@request.auth.id != "" && @request.auth.id = requester && (requestedItem.trusteesOnly = false || requestedItem.owner = @request.auth.id || requestedItem.owner.trusts.id ?= @request.auth.id)'
        app.save(c)
    }
)
