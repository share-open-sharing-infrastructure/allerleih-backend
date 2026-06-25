/// <reference path="../pb_data/types.d.ts" />

// Add a `groups` multi-relation to items and widen the trust visibility rule:
// a trustees-only item is now also readable by members of any group attached to
// it. cascadeDelete is false on the relation, so deleting a group merely drops
// it from the item's `groups` list -> the item stays trustees-only (falls back
// to "private to the owner's trust circle"), it never becomes public.
migrate((app) => {
    const collection = app.findCollectionByNameOrId("qyvc6pcix0fuqis")

    collection.fields.add(new Field({
        "cascadeDelete": false,
        "collectionId": "pbc_groups00001",
        "hidden": false,
        "id": "relation_item_groups",
        "maxSelect": 50,
        "minSelect": 0,
        "name": "groups",
        "presentable": false,
        "required": false,
        "system": false,
        "type": "relation"
    }))

    const rule =
        '@request.auth.id != "" && (trusteesOnly = false || @request.auth.id = owner || owner.trusts.id ?= @request.auth.id || groups.group_members_via_group.user.id ?= @request.auth.id)'
    collection.listRule = rule
    collection.viewRule = rule

    return app.save(collection)
}, (app) => {
    const collection = app.findCollectionByNameOrId("qyvc6pcix0fuqis")

    collection.fields.removeById("relation_item_groups")

    // Restore the pre-groups trust rule (see 1781900031_items_trust_rule.js).
    const rule =
        '@request.auth.id != "" && (trusteesOnly = false || @request.auth.id = owner || owner.trusts.id ?= @request.auth.id)'
    collection.listRule = rule
    collection.viewRule = rule

    return app.save(collection)
})
