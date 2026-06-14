/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_2268005888")

  // update collection data
  unmarshal({
    "viewQuery": "SELECT \n  items.id, items.name, items.image, items.externalImgUrl, items.externalUrl, items.description, items.trusteesOnly, items.status, items.categories, items.updated,\n  users.id as userId, users.username, users.trusts, users.isInstitution, users.bio, users.verified, users.profileImage, users.created as userCreated,\n    (\n    users.geolocation IS NOT NULL\n    AND users.geolocation != ''\n    AND NOT (\n      json_extract(users.geolocation, '$.lon') = 0\n      AND json_extract(users.geolocation, '$.lat') = 0\n    )\n  ) AS ownerHasLocation\nFROM items\nLEFT JOIN users on items.owner = users.id"
  }, collection)

  // remove field
  collection.fields.removeById("_clone_N31P")

  // remove field
  collection.fields.removeById("_clone_m5F3")

  // remove field
  collection.fields.removeById("_clone_OW1v")

  // remove field
  collection.fields.removeById("_clone_A2I2")

  // remove field
  collection.fields.removeById("_clone_YjC4")

  // remove field
  collection.fields.removeById("_clone_i8Qn")

  // remove field
  collection.fields.removeById("_clone_ds0D")

  // remove field
  collection.fields.removeById("_clone_nr3W")

  // remove field
  collection.fields.removeById("_clone_jgly")

  // remove field
  collection.fields.removeById("_clone_27oD")

  // remove field
  collection.fields.removeById("_clone_VoDY")

  // remove field
  collection.fields.removeById("_clone_kLhk")

  // remove field
  collection.fields.removeById("_clone_PhZz")

  // remove field
  collection.fields.removeById("_clone_2mAI")

  // remove field
  collection.fields.removeById("_clone_7OKx")

  // add field
  collection.fields.addAt(1, new Field({
    "autogeneratePattern": "",
    "hidden": false,
    "id": "_clone_bz0U",
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
    "hidden": false,
    "id": "_clone_DUTw",
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
    "hidden": false,
    "id": "_clone_k4A3",
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
    "hidden": false,
    "id": "_clone_9j05",
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
    "hidden": false,
    "id": "_clone_iSOw",
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
    "hidden": false,
    "id": "_clone_V3iL",
    "name": "trusteesOnly",
    "presentable": false,
    "required": false,
    "system": false,
    "type": "bool"
  }))

  // add field
  collection.fields.addAt(7, new Field({
    "hidden": false,
    "id": "_clone_VBzh",
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
    "hidden": false,
    "id": "_clone_eekE",
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
    "id": "_clone_EZWq",
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
    "hidden": false,
    "id": "_clone_GF0e",
    "max": 150,
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
    "hidden": false,
    "id": "_clone_dbFI",
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
    "hidden": false,
    "id": "_clone_KWL9",
    "name": "isInstitution",
    "presentable": false,
    "required": false,
    "system": false,
    "type": "bool"
  }))

  // add field
  collection.fields.addAt(14, new Field({
    "convertURLs": false,
    "hidden": false,
    "id": "_clone_5Zl0",
    "maxSize": 0,
    "name": "bio",
    "presentable": false,
    "required": false,
    "system": false,
    "type": "editor"
  }))

  // add field
  collection.fields.addAt(15, new Field({
    "hidden": false,
    "id": "_clone_zJug",
    "name": "verified",
    "presentable": false,
    "required": false,
    "system": true,
    "type": "bool"
  }))

  // add field
  collection.fields.addAt(16, new Field({
    "hidden": false,
    "id": "_clone_Ovlv",
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
    "id": "_clone_rAh1",
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
    "viewQuery": "SELECT \n  items.id, items.name, items.image, items.externalImgUrl, items.externalUrl, items.description, items.trusteesOnly, items.status, items.categories, items.updated,\n  users.id as userId, users.username, users.trusts, users.isInstitution, users.bio, users.verified, users.profileImage,\n    (\n    users.geolocation IS NOT NULL\n    AND users.geolocation != ''\n    AND NOT (\n      json_extract(users.geolocation, '$.lon') = 0\n      AND json_extract(users.geolocation, '$.lat') = 0\n    )\n  ) AS ownerHasLocation\nFROM items\nLEFT JOIN users on items.owner = users.id"
  }, collection)

  // add field
  collection.fields.addAt(1, new Field({
    "autogeneratePattern": "",
    "hidden": false,
    "id": "_clone_N31P",
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
    "hidden": false,
    "id": "_clone_m5F3",
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
    "hidden": false,
    "id": "_clone_OW1v",
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
    "hidden": false,
    "id": "_clone_A2I2",
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
    "hidden": false,
    "id": "_clone_YjC4",
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
    "hidden": false,
    "id": "_clone_i8Qn",
    "name": "trusteesOnly",
    "presentable": false,
    "required": false,
    "system": false,
    "type": "bool"
  }))

  // add field
  collection.fields.addAt(7, new Field({
    "hidden": false,
    "id": "_clone_ds0D",
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
    "hidden": false,
    "id": "_clone_nr3W",
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
    "id": "_clone_jgly",
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
    "hidden": false,
    "id": "_clone_27oD",
    "max": 150,
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
    "hidden": false,
    "id": "_clone_VoDY",
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
    "hidden": false,
    "id": "_clone_kLhk",
    "name": "isInstitution",
    "presentable": false,
    "required": false,
    "system": false,
    "type": "bool"
  }))

  // add field
  collection.fields.addAt(14, new Field({
    "convertURLs": false,
    "hidden": false,
    "id": "_clone_PhZz",
    "maxSize": 0,
    "name": "bio",
    "presentable": false,
    "required": false,
    "system": false,
    "type": "editor"
  }))

  // add field
  collection.fields.addAt(15, new Field({
    "hidden": false,
    "id": "_clone_2mAI",
    "name": "verified",
    "presentable": false,
    "required": false,
    "system": true,
    "type": "bool"
  }))

  // add field
  collection.fields.addAt(16, new Field({
    "hidden": false,
    "id": "_clone_7OKx",
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

  // remove field
  collection.fields.removeById("_clone_bz0U")

  // remove field
  collection.fields.removeById("_clone_DUTw")

  // remove field
  collection.fields.removeById("_clone_k4A3")

  // remove field
  collection.fields.removeById("_clone_9j05")

  // remove field
  collection.fields.removeById("_clone_iSOw")

  // remove field
  collection.fields.removeById("_clone_V3iL")

  // remove field
  collection.fields.removeById("_clone_VBzh")

  // remove field
  collection.fields.removeById("_clone_eekE")

  // remove field
  collection.fields.removeById("_clone_EZWq")

  // remove field
  collection.fields.removeById("_clone_GF0e")

  // remove field
  collection.fields.removeById("_clone_dbFI")

  // remove field
  collection.fields.removeById("_clone_KWL9")

  // remove field
  collection.fields.removeById("_clone_5Zl0")

  // remove field
  collection.fields.removeById("_clone_zJug")

  // remove field
  collection.fields.removeById("_clone_Ovlv")

  // remove field
  collection.fields.removeById("_clone_rAh1")

  return app.save(collection)
})
