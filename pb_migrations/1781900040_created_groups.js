/// <reference path="../pb_data/types.d.ts" />

// Groups feature: a named, owner-managed circle that extends an owner's trust
// audience. A trustees-only item becomes visible to members of the groups
// selected on that item (in addition to owner + owner.trusts). Owner-only
// management. The owner relation cascadeDeletes the group when the owner's
// account is removed (a group for items that no longer exist makes no sense).
migrate((app) => {
    const collection = new Collection({
        "createRule": "@request.auth.id = owner",
        "updateRule": "@request.auth.id = owner",
        "deleteRule": "@request.auth.id = owner",
        // Owner-only for now; member visibility (a back-relation to group_members)
        // is added in 1781900043 once that collection exists.
        "listRule": "@request.auth.id = owner",
        "viewRule": "@request.auth.id = owner",
        "fields": [
            {
                "autogeneratePattern": "[a-z0-9]{15}",
                "hidden": false,
                "id": "text3208210256",
                "max": 15,
                "min": 15,
                "name": "id",
                "pattern": "^[a-z0-9]+$",
                "presentable": false,
                "primaryKey": true,
                "required": true,
                "system": true,
                "type": "text"
            },
            {
                "autogeneratePattern": "",
                "hidden": false,
                "id": "text_group_name",
                "max": 100,
                "min": 1,
                "name": "name",
                "pattern": "",
                "presentable": true,
                "primaryKey": false,
                "required": true,
                "system": false,
                "type": "text"
            },
            {
                "autogeneratePattern": "",
                "hidden": false,
                "id": "text_group_desc",
                "max": 500,
                "min": 0,
                "name": "description",
                "pattern": "",
                "presentable": false,
                "primaryKey": false,
                "required": false,
                "system": false,
                "type": "text"
            },
            {
                "cascadeDelete": true,
                "collectionId": "hbacudkt08pfcy3",
                "hidden": false,
                "id": "relation_group_owner",
                "maxSelect": 1,
                "minSelect": 0,
                "name": "owner",
                "presentable": false,
                "required": true,
                "system": false,
                "type": "relation"
            },
            {
                "hidden": false,
                "id": "autodate_group_created",
                "name": "created",
                "onCreate": true,
                "onUpdate": false,
                "presentable": false,
                "system": false,
                "type": "autodate"
            },
            {
                "hidden": false,
                "id": "autodate_group_updated",
                "name": "updated",
                "onCreate": true,
                "onUpdate": true,
                "presentable": false,
                "system": false,
                "type": "autodate"
            }
        ],
        "id": "pbc_groups00001",
        "indexes": [],
        "name": "groups",
        "system": false,
        "type": "base"
    });

    return app.save(collection);
}, (app) => {
    const collection = app.findCollectionByNameOrId("pbc_groups00001");

    return app.delete(collection);
})
