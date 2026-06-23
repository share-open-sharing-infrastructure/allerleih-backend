/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = new Collection({
    "createRule": "@request.auth.id = user",
    "deleteRule": "@request.auth.id = user",
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
        "name": "user",
        "presentable": false,
        "required": true,
        "system": false,
        "type": "relation"
      },
      {
        "help": "",
        "hidden": false,
        "id": "geoPoint2646664628",
        "name": "geolocation",
        "presentable": false,
        "required": false,
        "system": false,
        "type": "geoPoint"
      }
    ],
    "id": "pbc_3399425128",
    "indexes": [
      "CREATE UNIQUE INDEX `idx_ug_user` ON `user_geolocations` (`user`)"
    ],
    "listRule": "@request.auth.id = user",
    "name": "user_geolocations",
    "system": false,
    "type": "base",
    "updateRule": "@request.auth.id = user",
    "viewRule": "@request.auth.id = user"
  });

  return app.save(collection);
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_3399425128");

  return app.delete(collection);
})
