/// <reference path="../pb_data/types.d.ts" />

// Join table for the trust graph, replacing the self-referencing users.trusts[]
// multi-relation. A row {truster, trustee} means "truster trusts trustee" — the
// trustee may see the truster's trusteesOnly items and trusted-only contact
// handles (same directional semantics as the old array). Modeled on
// group_members: cascadeDelete on both relations (a hard user delete removes the
// edge; anonymize-in-place deletion still cleans up explicitly, see account.js),
// unique (truster, trustee) index. Only the truster may create/revoke an edge;
// both parties may read it (the trustee needs to see who trusts them).
migrate((app) => {
    const collection = new Collection({
        "createRule": "@request.auth.id = truster",
        "updateRule": null,
        "deleteRule": "@request.auth.id = truster",
        "listRule": "@request.auth.id = truster || @request.auth.id = trustee",
        "viewRule": "@request.auth.id = truster || @request.auth.id = trustee",
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
                "collectionId": "hbacudkt08pfcy3",
                "hidden": false,
                "id": "relation_tr_truster",
                "maxSelect": 1,
                "minSelect": 0,
                "name": "truster",
                "presentable": false,
                "required": true,
                "system": false,
                "type": "relation"
            },
            {
                "cascadeDelete": true,
                "collectionId": "hbacudkt08pfcy3",
                "hidden": false,
                "id": "relation_tr_trustee",
                "maxSelect": 1,
                "minSelect": 0,
                "name": "trustee",
                "presentable": false,
                "required": true,
                "system": false,
                "type": "relation"
            },
            {
                "hidden": false,
                "id": "autodate_tr_created",
                "name": "created",
                "onCreate": true,
                "onUpdate": false,
                "presentable": false,
                "system": false,
                "type": "autodate"
            }
        ],
        "id": "pbc_trusts00001",
        "indexes": [
            "CREATE UNIQUE INDEX `idx_trusts_truster_trustee` ON `trusts` (`truster`, `trustee`)"
        ],
        "name": "trusts",
        "system": false,
        "type": "base"
    });

    return app.save(collection);
}, (app) => {
    const collection = app.findCollectionByNameOrId("pbc_trusts00001");

    return app.delete(collection);
})
