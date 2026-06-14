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
        "autogeneratePattern": "users[0-9]{6}",
        "hidden": false,
        "id": "_clone_VoSH",
        "max": 150,
        "min": 3,
        "name": "username",
        "pattern": "^[\\w\\p{L}][\\w\\p{L}\\.\\-]*$",
        "presentable": false,
        "primaryKey": false,
        "required": true,
        "system": false,
        "type": "text"
      },
      {
        "autogeneratePattern": "",
        "hidden": false,
        "id": "_clone_noWX",
        "max": 0,
        "min": 0,
        "name": "city",
        "pattern": "",
        "presentable": false,
        "primaryKey": false,
        "required": false,
        "system": false,
        "type": "text"
      },
      {
        "convertURLs": false,
        "hidden": false,
        "id": "_clone_HXiU",
        "maxSize": 0,
        "name": "bio",
        "presentable": false,
        "required": false,
        "system": false,
        "type": "editor"
      },
      {
        "hidden": false,
        "id": "_clone_NyqB",
        "maxSelect": 1,
        "maxSize": 0,
        "mimeTypes": [],
        "name": "profileImage",
        "presentable": false,
        "protected": false,
        "required": false,
        "system": false,
        "thumbs": [],
        "type": "file"
      },
      {
        "hidden": false,
        "id": "_clone_s69l",
        "name": "isInstitution",
        "presentable": false,
        "required": false,
        "system": false,
        "type": "bool"
      },
      {
        "cascadeDelete": false,
        "collectionId": "hbacudkt08pfcy3",
        "hidden": false,
        "id": "_clone_gU0y",
        "maxSelect": 2147483647,
        "minSelect": 0,
        "name": "trusts",
        "presentable": false,
        "required": false,
        "system": false,
        "type": "relation"
      }
    ],
    "id": "pbc_1703855700",
    "indexes": [],
    "listRule": "@request.auth.id != \"\"",
    "name": "users_trusted",
    "system": false,
    "type": "view",
    "updateRule": null,
    "viewQuery": "SELECT\n  users.id,\n  users.username,\n  users.city,\n  users.bio,\n  users.profileImage,\n  users.isInstitution,\n  users.trusts\nFROM users",
    "viewRule": "@request.auth.id != \"\""
  });

  return app.save(collection);
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_1703855700");

  return app.delete(collection);
})
