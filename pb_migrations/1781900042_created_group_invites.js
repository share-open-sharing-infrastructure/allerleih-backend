/// <reference path="../pb_data/types.d.ts" />

// Shareable group invite links. Each invite carries a random token, an optional
// expiry, and an optional usage cap. Only the group owner can create/list/revoke
// invites (no public listing -> no token enumeration, matching invite.pb.js).
// Resolving a token to a group preview and joining happen via the group.pb.js
// hook in elevated context. Invites cascadeDelete with their group.
migrate((app) => {
    const collection = new Collection({
        "createRule": "@request.auth.id = group.owner",
        "updateRule": "@request.auth.id = group.owner",
        "deleteRule": "@request.auth.id = group.owner",
        "listRule": "@request.auth.id = group.owner",
        "viewRule": "@request.auth.id = group.owner",
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
                "cascadeDelete": true,
                "collectionId": "pbc_groups00001",
                "hidden": false,
                "id": "relation_gi_group",
                "maxSelect": 1,
                "minSelect": 0,
                "name": "group",
                "presentable": false,
                "required": true,
                "system": false,
                "type": "relation"
            },
            {
                "autogeneratePattern": "[a-z0-9]{24}",
                "hidden": false,
                "id": "text_gi_token",
                "max": 24,
                "min": 24,
                "name": "token",
                "pattern": "^[a-z0-9]+$",
                "presentable": false,
                "primaryKey": false,
                "required": true,
                "system": false,
                "type": "text"
            },
            {
                "hidden": false,
                "id": "date_gi_expires",
                "max": "",
                "min": "",
                "name": "expiresAt",
                "presentable": false,
                "required": false,
                "system": false,
                "type": "date"
            },
            {
                "hidden": false,
                "id": "number_gi_maxuses",
                "max": null,
                "min": 0,
                "name": "maxUses",
                "onlyInt": true,
                "presentable": false,
                "required": false,
                "system": false,
                "type": "number"
            },
            {
                "hidden": false,
                "id": "number_gi_uses",
                "max": null,
                "min": 0,
                "name": "uses",
                "onlyInt": true,
                "presentable": false,
                "required": false,
                "system": false,
                "type": "number"
            },
            {
                "cascadeDelete": false,
                "collectionId": "hbacudkt08pfcy3",
                "hidden": false,
                "id": "relation_gi_createdby",
                "maxSelect": 1,
                "minSelect": 0,
                "name": "createdBy",
                "presentable": false,
                "required": false,
                "system": false,
                "type": "relation"
            },
            {
                "hidden": false,
                "id": "autodate_gi_created",
                "name": "created",
                "onCreate": true,
                "onUpdate": false,
                "presentable": false,
                "system": false,
                "type": "autodate"
            }
        ],
        "id": "pbc_groupinv001",
        "indexes": [
            "CREATE UNIQUE INDEX `idx_gi_token` ON `group_invites` (`token`)"
        ],
        "name": "group_invites",
        "system": false,
        "type": "base"
    });

    return app.save(collection);
}, (app) => {
    const collection = app.findCollectionByNameOrId("pbc_groupinv001");

    return app.delete(collection);
})
