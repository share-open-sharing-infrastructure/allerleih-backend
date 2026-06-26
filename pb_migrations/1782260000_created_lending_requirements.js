/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = new Collection({
    // Anyone logged in may READ an owner's requirements (the item detail page
    // needs them to explain why a request is blocked — not sensitive data).
    // Only the owner may write their own row.
    "createRule": "@request.auth.id = owner",
    "deleteRule": "@request.auth.id = owner",
    "listRule": "@request.auth.id != \"\"",
    "viewRule": "@request.auth.id != \"\"",
    "updateRule": "@request.auth.id = owner",
    "fields": [
      {
        "autogeneratePattern": "[a-z0-9]{15}",
        "help": "",
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
        "help": "",
        "hidden": false,
        "id": "relation2375276105",
        "maxSelect": 1,
        "minSelect": 0,
        "name": "owner",
        "presentable": false,
        "required": true,
        "system": false,
        "type": "relation"
      },
      {
        "help": "",
        "hidden": false,
        "id": "bool1583242982",
        "name": "requireVerifiedEmail",
        "presentable": false,
        "required": false,
        "system": false,
        "type": "bool"
      }
    ],
    "id": "pbc_3920114050",
    "indexes": [
      "CREATE UNIQUE INDEX `idx_lr_owner` ON `lending_requirements` (`owner`)"
    ],
    "name": "lending_requirements",
    "system": false,
    "type": "base"
  });

  return app.save(collection);
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_3920114050");

  return app.delete(collection);
})
