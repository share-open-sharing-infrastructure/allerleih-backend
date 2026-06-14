/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_2268005888")

  // update collection data
  unmarshal({
    "viewQuery": "SELECT \n  items.id, items.name, items.image, items.externalImgUrl, items.description, items.trusteesOnly, items.status, items.categories, items.updated,\n  users.id as userId, users.username, users.trusts, users.isInstitution, users.verified\nFROM items\nLEFT JOIN users on items.owner = users.id"
  }, collection)

  // remove field
  collection.fields.removeById("_clone_3NFs")

  // remove field
  collection.fields.removeById("_clone_Ywv2")

  // remove field
  collection.fields.removeById("_clone_Z4Qx")

  // remove field
  collection.fields.removeById("_clone_gTA7")

  // remove field
  collection.fields.removeById("_clone_Ang4")

  // remove field
  collection.fields.removeById("_clone_Bb0y")

  // remove field
  collection.fields.removeById("_clone_gQ4j")

  // remove field
  collection.fields.removeById("_clone_WMi2")

  // remove field
  collection.fields.removeById("_clone_b8oa")

  // remove field
  collection.fields.removeById("_clone_ths9")

  // remove field
  collection.fields.removeById("_clone_GpRe")

  // add field
  collection.fields.addAt(1, new Field({
    "autogeneratePattern": "",
    "hidden": false,
    "id": "_clone_4bQM",
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
    "id": "_clone_8TP0",
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
    "id": "_clone_dFPc",
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
    "id": "_clone_hlPR",
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
  collection.fields.addAt(5, new Field({
    "hidden": false,
    "id": "_clone_aCTg",
    "name": "trusteesOnly",
    "presentable": false,
    "required": false,
    "system": false,
    "type": "bool"
  }))

  // add field
  collection.fields.addAt(6, new Field({
    "hidden": false,
    "id": "_clone_blED",
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
  collection.fields.addAt(7, new Field({
    "hidden": false,
    "id": "_clone_eGMd",
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
  collection.fields.addAt(8, new Field({
    "hidden": false,
    "id": "_clone_z9fp",
    "name": "updated",
    "onCreate": true,
    "onUpdate": true,
    "presentable": false,
    "system": false,
    "type": "autodate"
  }))

  // add field
  collection.fields.addAt(10, new Field({
    "autogeneratePattern": "users[0-9]{6}",
    "hidden": false,
    "id": "_clone_0Unx",
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
  collection.fields.addAt(11, new Field({
    "cascadeDelete": false,
    "collectionId": "hbacudkt08pfcy3",
    "hidden": false,
    "id": "_clone_E7Mm",
    "maxSelect": 2147483647,
    "minSelect": 0,
    "name": "trusts",
    "presentable": false,
    "required": false,
    "system": false,
    "type": "relation"
  }))

  // add field
  collection.fields.addAt(12, new Field({
    "hidden": false,
    "id": "_clone_hCV9",
    "name": "isInstitution",
    "presentable": false,
    "required": false,
    "system": false,
    "type": "bool"
  }))

  // add field
  collection.fields.addAt(13, new Field({
    "hidden": false,
    "id": "_clone_IqyV",
    "name": "verified",
    "presentable": false,
    "required": false,
    "system": true,
    "type": "bool"
  }))

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_2268005888")

  // update collection data
  unmarshal({
    "viewQuery": "SELECT \n  items.id, items.name, items.image, items.externalImgUrl, items.description, items.trusteesOnly, items.status, items.categories, items.updated,\n  users.id as userId, users.username, users.trusts, users.isInstitution\nFROM items\nLEFT JOIN users on items.owner = users.id"
  }, collection)

  // add field
  collection.fields.addAt(1, new Field({
    "autogeneratePattern": "",
    "hidden": false,
    "id": "_clone_3NFs",
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
    "id": "_clone_Ywv2",
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
    "id": "_clone_Z4Qx",
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
    "id": "_clone_gTA7",
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
  collection.fields.addAt(5, new Field({
    "hidden": false,
    "id": "_clone_Ang4",
    "name": "trusteesOnly",
    "presentable": false,
    "required": false,
    "system": false,
    "type": "bool"
  }))

  // add field
  collection.fields.addAt(6, new Field({
    "hidden": false,
    "id": "_clone_Bb0y",
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
  collection.fields.addAt(7, new Field({
    "hidden": false,
    "id": "_clone_gQ4j",
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
  collection.fields.addAt(8, new Field({
    "hidden": false,
    "id": "_clone_WMi2",
    "name": "updated",
    "onCreate": true,
    "onUpdate": true,
    "presentable": false,
    "system": false,
    "type": "autodate"
  }))

  // add field
  collection.fields.addAt(10, new Field({
    "autogeneratePattern": "users[0-9]{6}",
    "hidden": false,
    "id": "_clone_b8oa",
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
  collection.fields.addAt(11, new Field({
    "cascadeDelete": false,
    "collectionId": "hbacudkt08pfcy3",
    "hidden": false,
    "id": "_clone_ths9",
    "maxSelect": 2147483647,
    "minSelect": 0,
    "name": "trusts",
    "presentable": false,
    "required": false,
    "system": false,
    "type": "relation"
  }))

  // add field
  collection.fields.addAt(12, new Field({
    "hidden": false,
    "id": "_clone_GpRe",
    "name": "isInstitution",
    "presentable": false,
    "required": false,
    "system": false,
    "type": "bool"
  }))

  // remove field
  collection.fields.removeById("_clone_4bQM")

  // remove field
  collection.fields.removeById("_clone_8TP0")

  // remove field
  collection.fields.removeById("_clone_dFPc")

  // remove field
  collection.fields.removeById("_clone_hlPR")

  // remove field
  collection.fields.removeById("_clone_aCTg")

  // remove field
  collection.fields.removeById("_clone_blED")

  // remove field
  collection.fields.removeById("_clone_eGMd")

  // remove field
  collection.fields.removeById("_clone_z9fp")

  // remove field
  collection.fields.removeById("_clone_0Unx")

  // remove field
  collection.fields.removeById("_clone_E7Mm")

  // remove field
  collection.fields.removeById("_clone_hCV9")

  // remove field
  collection.fields.removeById("_clone_IqyV")

  return app.save(collection)
})
