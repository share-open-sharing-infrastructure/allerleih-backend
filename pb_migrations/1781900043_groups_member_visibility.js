/// <reference path="../pb_data/types.d.ts" />

// Now that group_members exists, widen the groups list/view rule so members can
// see the groups they belong to (not just the owner). Split out from the groups
// creation migration because the back-relation field group_members_via_group
// can't resolve before the group_members collection is created.
migrate((app) => {
    const collection = app.findCollectionByNameOrId("pbc_groups00001")
    const rule = "@request.auth.id = owner || group_members_via_group.user.id ?= @request.auth.id"
    collection.listRule = rule
    collection.viewRule = rule
    return app.save(collection)
}, (app) => {
    const collection = app.findCollectionByNameOrId("pbc_groups00001")
    collection.listRule = "@request.auth.id = owner"
    collection.viewRule = "@request.auth.id = owner"
    return app.save(collection)
})
