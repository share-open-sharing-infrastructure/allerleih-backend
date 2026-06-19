/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_2268005888")

  // update collection data
  unmarshal({
    "viewQuery": "SELECT \n  items.id, items.name, items.image, items.externalImgUrl, items.externalUrl, items.description, items.trusteesOnly, items.status, items.categories, items.updated,\n  users.id as userId, users.username, users.trusts, users.isInstitution, users.bio, users.verified, users.profileImage, users.created as userCreated,\n    (\n    ug.geolocation IS NOT NULL\n    AND ug.geolocation != ''\n    AND NOT (\n      json_extract(ug.geolocation, '$.lon') = 0\n      AND json_extract(ug.geolocation, '$.lat') = 0\n    )\n  ) AS ownerHasLocation\nFROM items\nLEFT JOIN users on items.owner = users.id\nLEFT JOIN user_geolocations ug on ug.user = users.id"
  }, collection)

  // remove field
  collection.fields.removeById("_clone_HRjm")

  // remove field
  collection.fields.removeById("_clone_eUuQ")

  // remove field
  collection.fields.removeById("_clone_JFqo")

  // remove field
  collection.fields.removeById("_clone_BKAo")

  // remove field
  collection.fields.removeById("_clone_Denm")

  // remove field
  collection.fields.removeById("_clone_qYg6")

  // remove field
  collection.fields.removeById("_clone_X6El")

  // remove field
  collection.fields.removeById("_clone_Jp7L")

  // remove field
  collection.fields.removeById("_clone_SU18")

  // remove field
  collection.fields.removeById("_clone_0onN")

  // remove field
  collection.fields.removeById("_clone_lQAd")

  // remove field
  collection.fields.removeById("_clone_XYXb")

  // remove field
  collection.fields.removeById("_clone_y7YW")

  // remove field
  collection.fields.removeById("_clone_5Xth")

  // remove field
  collection.fields.removeById("_clone_b4cB")

  // remove field
  collection.fields.removeById("_clone_l61W")

  // add field
  collection.fields.addAt(1, new Field({
    "autogeneratePattern": "",
    "help": "",
    "hidden": false,
    "id": "_clone_UuYW",
    "max": 0,
    "min": 0,
    "name": "name",
    "pattern": "",
    "presentable": false,
    "primaryKey": false,
    "required": true,
    "system": false,
    "type": "text"
  }))

  // add field
  collection.fields.addAt(2, new Field({
    "help": "",
    "hidden": false,
    "id": "_clone_AamF",
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
  }))

  // add field
  collection.fields.addAt(3, new Field({
    "autogeneratePattern": "",
    "help": "",
    "hidden": false,
    "id": "_clone_IgoG",
    "max": 0,
    "min": 0,
    "name": "externalImgUrl",
    "pattern": "",
    "presentable": false,
    "primaryKey": false,
    "required": false,
    "system": false,
    "type": "text"
  }))

  // add field
  collection.fields.addAt(4, new Field({
    "autogeneratePattern": "",
    "help": "",
    "hidden": false,
    "id": "_clone_xXEH",
    "max": 0,
    "min": 0,
    "name": "externalUrl",
    "pattern": "",
    "presentable": false,
    "primaryKey": false,
    "required": false,
    "system": false,
    "type": "text"
  }))

  // add field
  collection.fields.addAt(5, new Field({
    "autogeneratePattern": "",
    "help": "",
    "hidden": false,
    "id": "_clone_OgVk",
    "max": 0,
    "min": 0,
    "name": "description",
    "pattern": "",
    "presentable": false,
    "primaryKey": false,
    "required": false,
    "system": false,
    "type": "text"
  }))

  // add field
  collection.fields.addAt(6, new Field({
    "help": "",
    "hidden": false,
    "id": "_clone_aJ1X",
    "name": "trusteesOnly",
    "presentable": false,
    "required": false,
    "system": false,
    "type": "bool"
  }))

  // add field
  collection.fields.addAt(7, new Field({
    "help": "",
    "hidden": false,
    "id": "_clone_MAFw",
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
  }))

  // add field
  collection.fields.addAt(8, new Field({
    "help": "",
    "hidden": false,
    "id": "_clone_jzLP",
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
  }))

  // add field
  collection.fields.addAt(9, new Field({
    "hidden": false,
    "id": "_clone_BYH4",
    "name": "updated",
    "onCreate": true,
    "onUpdate": true,
    "presentable": false,
    "system": false,
    "type": "autodate"
  }))

  // add field
  collection.fields.addAt(11, new Field({
    "autogeneratePattern": "users[0-9]{6}",
    "help": "",
    "hidden": false,
    "id": "_clone_825R",
    "max": 25,
    "min": 3,
    "name": "username",
    "pattern": "^[\\w\\p{L}][\\w\\p{L}\\.\\-]*$",
    "presentable": false,
    "primaryKey": false,
    "required": true,
    "system": false,
    "type": "text"
  }))

  // add field
  collection.fields.addAt(12, new Field({
    "cascadeDelete": false,
    "collectionId": "hbacudkt08pfcy3",
    "help": "",
    "hidden": false,
    "id": "_clone_7o2d",
    "maxSelect": 2147483647,
    "minSelect": 0,
    "name": "trusts",
    "presentable": false,
    "required": false,
    "system": false,
    "type": "relation"
  }))

  // add field
  collection.fields.addAt(13, new Field({
    "help": "",
    "hidden": false,
    "id": "_clone_i2IS",
    "name": "isInstitution",
    "presentable": false,
    "required": false,
    "system": false,
    "type": "bool"
  }))

  // add field
  collection.fields.addAt(14, new Field({
    "convertURLs": false,
    "help": "",
    "hidden": false,
    "id": "_clone_3Q0i",
    "maxSize": 0,
    "name": "bio",
    "presentable": false,
    "required": false,
    "system": false,
    "type": "editor"
  }))

  // add field
  collection.fields.addAt(15, new Field({
    "help": "",
    "hidden": false,
    "id": "_clone_pAX2",
    "name": "verified",
    "presentable": false,
    "required": false,
    "system": true,
    "type": "bool"
  }))

  // add field
  collection.fields.addAt(16, new Field({
    "help": "",
    "hidden": false,
    "id": "_clone_RK33",
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
  }))

  // add field
  collection.fields.addAt(17, new Field({
    "hidden": false,
    "id": "_clone_UIgR",
    "name": "userCreated",
    "onCreate": true,
    "onUpdate": false,
    "presentable": false,
    "system": false,
    "type": "autodate"
  }))

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_2268005888")

  // update collection data
  unmarshal({
    "viewQuery": "SELECT \n  items.id, items.name, items.image, items.externalImgUrl, items.externalUrl, items.description, items.trusteesOnly, items.status, items.categories, items.updated,\n  users.id as userId, users.username, users.trusts, users.isInstitution, users.bio, users.verified, users.profileImage, users.created as userCreated,\n    (\n    users.geolocation IS NOT NULL\n    AND users.geolocation != ''\n    AND NOT (\n      json_extract(users.geolocation, '$.lon') = 0\n      AND json_extract(users.geolocation, '$.lat') = 0\n    )\n  ) AS ownerHasLocation\nFROM items\nLEFT JOIN users on items.owner = users.id"
  }, collection)

  // add field
  collection.fields.addAt(1, new Field({
    "autogeneratePattern": "",
    "help": "",
    "hidden": false,
    "id": "_clone_HRjm",
    "max": 0,
    "min": 0,
    "name": "name",
    "pattern": "",
    "presentable": false,
    "primaryKey": false,
    "required": true,
    "system": false,
    "type": "text"
  }))

  // add field
  collection.fields.addAt(2, new Field({
    "help": "",
    "hidden": false,
    "id": "_clone_eUuQ",
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
  }))

  // add field
  collection.fields.addAt(3, new Field({
    "autogeneratePattern": "",
    "help": "",
    "hidden": false,
    "id": "_clone_JFqo",
    "max": 0,
    "min": 0,
    "name": "externalImgUrl",
    "pattern": "",
    "presentable": false,
    "primaryKey": false,
    "required": false,
    "system": false,
    "type": "text"
  }))

  // add field
  collection.fields.addAt(4, new Field({
    "autogeneratePattern": "",
    "help": "",
    "hidden": false,
    "id": "_clone_BKAo",
    "max": 0,
    "min": 0,
    "name": "externalUrl",
    "pattern": "",
    "presentable": false,
    "primaryKey": false,
    "required": false,
    "system": false,
    "type": "text"
  }))

  // add field
  collection.fields.addAt(5, new Field({
    "autogeneratePattern": "",
    "help": "",
    "hidden": false,
    "id": "_clone_Denm",
    "max": 0,
    "min": 0,
    "name": "description",
    "pattern": "",
    "presentable": false,
    "primaryKey": false,
    "required": false,
    "system": false,
    "type": "text"
  }))

  // add field
  collection.fields.addAt(6, new Field({
    "help": "",
    "hidden": false,
    "id": "_clone_qYg6",
    "name": "trusteesOnly",
    "presentable": false,
    "required": false,
    "system": false,
    "type": "bool"
  }))

  // add field
  collection.fields.addAt(7, new Field({
    "help": "",
    "hidden": false,
    "id": "_clone_X6El",
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
  }))

  // add field
  collection.fields.addAt(8, new Field({
    "help": "",
    "hidden": false,
    "id": "_clone_Jp7L",
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
  }))

  // add field
  collection.fields.addAt(9, new Field({
    "hidden": false,
    "id": "_clone_SU18",
    "name": "updated",
    "onCreate": true,
    "onUpdate": true,
    "presentable": false,
    "system": false,
    "type": "autodate"
  }))

  // add field
  collection.fields.addAt(11, new Field({
    "autogeneratePattern": "users[0-9]{6}",
    "help": "",
    "hidden": false,
    "id": "_clone_0onN",
    "max": 25,
    "min": 3,
    "name": "username",
    "pattern": "^[\\w\\p{L}][\\w\\p{L}\\.\\-]*$",
    "presentable": false,
    "primaryKey": false,
    "required": true,
    "system": false,
    "type": "text"
  }))

  // add field
  collection.fields.addAt(12, new Field({
    "cascadeDelete": false,
    "collectionId": "hbacudkt08pfcy3",
    "help": "",
    "hidden": false,
    "id": "_clone_lQAd",
    "maxSelect": 2147483647,
    "minSelect": 0,
    "name": "trusts",
    "presentable": false,
    "required": false,
    "system": false,
    "type": "relation"
  }))

  // add field
  collection.fields.addAt(13, new Field({
    "help": "",
    "hidden": false,
    "id": "_clone_XYXb",
    "name": "isInstitution",
    "presentable": false,
    "required": false,
    "system": false,
    "type": "bool"
  }))

  // add field
  collection.fields.addAt(14, new Field({
    "convertURLs": false,
    "help": "",
    "hidden": false,
    "id": "_clone_y7YW",
    "maxSize": 0,
    "name": "bio",
    "presentable": false,
    "required": false,
    "system": false,
    "type": "editor"
  }))

  // add field
  collection.fields.addAt(15, new Field({
    "help": "",
    "hidden": false,
    "id": "_clone_5Xth",
    "name": "verified",
    "presentable": false,
    "required": false,
    "system": true,
    "type": "bool"
  }))

  // add field
  collection.fields.addAt(16, new Field({
    "help": "",
    "hidden": false,
    "id": "_clone_b4cB",
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
  }))

  // add field
  collection.fields.addAt(17, new Field({
    "hidden": false,
    "id": "_clone_l61W",
    "name": "userCreated",
    "onCreate": true,
    "onUpdate": false,
    "presentable": false,
    "system": false,
    "type": "autodate"
  }))

  // remove field
  collection.fields.removeById("_clone_UuYW")

  // remove field
  collection.fields.removeById("_clone_AamF")

  // remove field
  collection.fields.removeById("_clone_IgoG")

  // remove field
  collection.fields.removeById("_clone_xXEH")

  // remove field
  collection.fields.removeById("_clone_OgVk")

  // remove field
  collection.fields.removeById("_clone_aJ1X")

  // remove field
  collection.fields.removeById("_clone_MAFw")

  // remove field
  collection.fields.removeById("_clone_jzLP")

  // remove field
  collection.fields.removeById("_clone_BYH4")

  // remove field
  collection.fields.removeById("_clone_825R")

  // remove field
  collection.fields.removeById("_clone_7o2d")

  // remove field
  collection.fields.removeById("_clone_i2IS")

  // remove field
  collection.fields.removeById("_clone_3Q0i")

  // remove field
  collection.fields.removeById("_clone_pAX2")

  // remove field
  collection.fields.removeById("_clone_RK33")

  // remove field
  collection.fields.removeById("_clone_UIgR")

  return app.save(collection)
})
