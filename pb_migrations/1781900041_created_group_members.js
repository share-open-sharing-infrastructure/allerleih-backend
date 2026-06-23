/// <reference path="../pb_data/types.d.ts" />

// Join table for group membership. The group owner is NOT stored here (it lives
// on groups.owner); this holds the invited members. cascadeDelete on both
// relations: deleting a group drops its memberships, deleting a user drops their
// memberships. A unique (group, user) index prevents duplicate joins.
migrate((app) => {
    const collection = new Collection({
        // Owner adds members directly; invite-based joins go through the
        // group.pb.js hook (elevated context, bypasses API rules).
        "createRule": "@request.auth.id = group.owner",
        "updateRule": null,
        // Owner can remove anyone; a member can remove themselves (leave).
        "deleteRule": "@request.auth.id = group.owner || @request.auth.id = user",
        // Owner sees the full member list; a user sees their own membership rows.
        "listRule": "@request.auth.id = group.owner || @request.auth.id = user",
        "viewRule": "@request.auth.id = group.owner || @request.auth.id = user",
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
                "id": "relation_gm_group",
                "maxSelect": 1,
                "minSelect": 0,
                "name": "group",
                "presentable": false,
                "required": true,
                "system": false,
                "type": "relation"
            },
            {
                "cascadeDelete": true,
                "collectionId": "hbacudkt08pfcy3",
                "hidden": false,
                "id": "relation_gm_user",
                "maxSelect": 1,
                "minSelect": 0,
                "name": "user",
                "presentable": false,
                "required": true,
                "system": false,
                "type": "relation"
            },
            {
                "hidden": false,
                "id": "autodate_gm_created",
                "name": "created",
                "onCreate": true,
                "onUpdate": false,
                "presentable": false,
                "system": false,
                "type": "autodate"
            }
        ],
        "id": "pbc_groupmem001",
        "indexes": [
            "CREATE UNIQUE INDEX `idx_gm_group_user` ON `group_members` (`group`, `user`)"
        ],
        "name": "group_members",
        "system": false,
        "type": "base"
    });

    return app.save(collection);
}, (app) => {
    const collection = app.findCollectionByNameOrId("pbc_groupmem001");

    return app.delete(collection);
})
