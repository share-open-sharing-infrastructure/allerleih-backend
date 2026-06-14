/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = new Collection({
    "createRule": null,
    "deleteRule": null,
    "fields": [
      {
        "autogeneratePattern": "",
        "hidden": false,
        "id": "text3208210256",
        "max": 0,
        "min": 0,
        "name": "id",
        "pattern": "^[a-z0-9]+$",
        "presentable": false,
        "primaryKey": true,
        "required": true,
        "system": true,
        "type": "text"
      },
      {
        "convertURLs": false,
        "hidden": false,
        "id": "_clone_o1vb",
        "maxSize": 0,
        "name": "bio",
        "presentable": false,
        "required": false,
        "system": false,
        "type": "editor"
      }
    ],
    "id": "pbc_3565108830",
    "indexes": [],
    "listRule": null,
    "name": "users_public",
    "system": false,
    "type": "view",
    "updateRule": null,
    "viewQuery": "SELECT users.id, users.bio\nFROM users",
    "viewRule": null
  });

  return app.save(collection);
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_3565108830");

  return app.delete(collection);
})
