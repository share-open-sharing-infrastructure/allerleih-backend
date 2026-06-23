/// <reference path="../pb_data/types.d.ts" />

// Search-facing view. Unlike the public `items_public` view (which masks
// trustees-only items so the existence/category is shown but the content is
// hidden), this view enforces trust at the row level via its rule: public items
// are visible to everyone, while trustees-only items are returned ONLY to the
// owner and to users the owner trusts. Content is therefore never masked here —
// rows a viewer may not see are filtered out entirely, and the owner's trusts
// list is never exposed (it is only traversed inside the rule). The search page
// reads from this view so trusted users find trusted owners' items in search.
migrate((app) => {
  const collection = new Collection({
    "createRule": null,
    "deleteRule": null,
    "fields": [
      {
        "autogeneratePattern": "",
        "help": "",
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
        "autogeneratePattern": "",
        "help": "",
        "hidden": false,
        "id": "_clone_bKOL",
        "max": 0,
        "min": 0,
        "name": "name",
        "pattern": "",
        "presentable": false,
        "primaryKey": false,
        "required": true,
        "system": false,
        "type": "text"
      },
      {
        "help": "",
        "hidden": false,
        "id": "_clone_y163",
        "maxSelect": 1,
        "maxSize": 5242880,
        "mimeTypes": [],
        "name": "image",
        "presentable": false,
        "protected": false,
        "required": false,
        "system": false,
        "thumbs": [],
        "type": "file"
      },
      {
        "autogeneratePattern": "",
        "help": "",
        "hidden": false,
        "id": "_clone_qfzf",
        "max": 0,
        "min": 0,
        "name": "externalImgUrl",
        "pattern": "",
        "presentable": false,
        "primaryKey": false,
        "required": false,
        "system": false,
        "type": "text"
      },
      {
        "autogeneratePattern": "",
        "help": "",
        "hidden": false,
        "id": "_clone_LKSL",
        "max": 0,
        "min": 0,
        "name": "externalUrl",
        "pattern": "",
        "presentable": false,
        "primaryKey": false,
        "required": false,
        "system": false,
        "type": "text"
      },
      {
        "autogeneratePattern": "",
        "help": "",
        "hidden": false,
        "id": "_clone_3pBh",
        "max": 0,
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
        "help": "",
        "hidden": false,
        "id": "_clone_Ogw0",
        "name": "trusteesOnly",
        "presentable": false,
        "required": false,
        "system": false,
        "type": "bool"
      },
      {
        "help": "",
        "hidden": false,
        "id": "_clone_FBpb",
        "maxSelect": 1,
        "name": "status",
        "presentable": false,
        "required": false,
        "system": false,
        "type": "select",
        "values": [
          "available",
          "unavailable",
          "unknown"
        ]
      },
      {
        "help": "",
        "hidden": false,
        "id": "_clone_kFEe",
        "maxSelect": 3,
        "name": "categories",
        "presentable": false,
        "required": false,
        "system": false,
        "type": "select",
        "values": [
          "Bücher",
          "Spiele",
          "Küche",
          "Elektronik",
          "Für Kinder",
          "Sonstiges",
          "Werkzeug und Garten",
          "Freizeit und Sport",
          "Ton und Licht",
          "Reisen und Outdoor"
        ]
      },
      {
        "hidden": false,
        "id": "_clone_DEqa",
        "name": "updated",
        "onCreate": true,
        "onUpdate": true,
        "presentable": false,
        "system": false,
        "type": "autodate"
      },
      {
        "cascadeDelete": false,
        "collectionId": "hbacudkt08pfcy3",
        "help": "",
        "hidden": false,
        "id": "relation1689669068",
        "maxSelect": 1,
        "minSelect": 0,
        "name": "userId",
        "presentable": false,
        "required": false,
        "system": false,
        "type": "relation"
      },
      {
        "autogeneratePattern": "users[0-9]{6}",
        "help": "",
        "hidden": false,
        "id": "_clone_HGxl",
        "max": 25,
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
        "help": "",
        "hidden": false,
        "id": "_clone_You3",
        "name": "isInstitution",
        "presentable": false,
        "required": false,
        "system": false,
        "type": "bool"
      },
      {
        "convertURLs": false,
        "help": "",
        "hidden": false,
        "id": "_clone_lqJV",
        "maxSize": 0,
        "name": "bio",
        "presentable": false,
        "required": false,
        "system": false,
        "type": "editor"
      },
      {
        "help": "",
        "hidden": false,
        "id": "_clone_uv5Z",
        "name": "verified",
        "presentable": false,
        "required": false,
        "system": true,
        "type": "bool"
      },
      {
        "help": "",
        "hidden": false,
        "id": "_clone_bsSq",
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
        "id": "_clone_XEV0",
        "name": "userCreated",
        "onCreate": true,
        "onUpdate": false,
        "presentable": false,
        "system": false,
        "type": "autodate"
      },
      {
        "help": "",
        "hidden": false,
        "id": "json65832145",
        "maxSize": 1,
        "name": "ownerHasLocation",
        "presentable": false,
        "required": false,
        "system": false,
        "type": "json"
      }
    ],
    "id": "pbc_1350744161",
    "indexes": [],
    "listRule": "trusteesOnly = false || (@request.auth.id != \"\" && (@request.auth.id = userId || userId.trusts.id ?= @request.auth.id))",
    "name": "items_searchable",
    "system": false,
    "type": "view",
    "updateRule": null,
    "viewQuery": "SELECT\n  items.id, items.name, items.image, items.externalImgUrl, items.externalUrl, items.description,\n  items.trusteesOnly, items.status, items.categories, items.updated,\n  users.id as userId, users.username, users.isInstitution, users.bio, users.verified, users.profileImage, users.created as userCreated,\n  (\n    ug.geolocation IS NOT NULL AND ug.geolocation != '' AND NOT (json_extract(ug.geolocation, '$.lon') = 0 AND json_extract(ug.geolocation, '$.lat') = 0)\n  ) AS ownerHasLocation\nFROM items\nLEFT JOIN users on items.owner = users.id\nLEFT JOIN user_geolocations ug on ug.user = users.id",
    "viewRule": "trusteesOnly = false || (@request.auth.id != \"\" && (@request.auth.id = userId || userId.trusts.id ?= @request.auth.id))"
  });

  return app.save(collection);
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_1350744161");

  return app.delete(collection);
})
