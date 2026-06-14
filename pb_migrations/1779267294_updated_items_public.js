/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_2268005888")

  // update collection data
  unmarshal({
    "viewQuery": "SELECT \n  items.id, items.name, items.image, items.externalImgUrl, items.owner,\n  users.username\nFROM items\nLEFT JOIN users on items.owner = users.id"
  }, collection)

  // remove field
  collection.fields.removeById("_clone_632J")

  // remove field
  collection.fields.removeById("_clone_77Nr")

  // remove field
  collection.fields.removeById("_clone_oSsB")

  // remove field
  collection.fields.removeById("_clone_yjVN")

  // add field
  collection.fields.addAt(1, new Field({
    "autogeneratePattern": "",
    "hidden": false,
    "id": "_clone_TXyQ",
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
    "id": "_clone_P9ma",
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
    "id": "_clone_IvVW",
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
    "cascadeDelete": false,
    "collectionId": "hbacudkt08pfcy3",
    "hidden": false,
    "id": "_clone_sSJE",
    "maxSelect": 1,
    "minSelect": 0,
    "name": "owner",
    "presentable": false,
    "required": true,
    "system": false,
    "type": "relation"
  }))

  // add field
  collection.fields.addAt(5, new Field({
    "autogeneratePattern": "users[0-9]{6}",
    "hidden": false,
    "id": "_clone_atB1",
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

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_2268005888")

  // update collection data
  unmarshal({
    "viewQuery": "SELECT items.id, items.name, items.image, items.externalImgUrl, items.owner\nFROM items\nLEFT JOIN users on items.owner = users.id"
  }, collection)

  // add field
  collection.fields.addAt(1, new Field({
    "autogeneratePattern": "",
    "hidden": false,
    "id": "_clone_632J",
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
    "id": "_clone_77Nr",
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
    "id": "_clone_oSsB",
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
    "cascadeDelete": false,
    "collectionId": "hbacudkt08pfcy3",
    "hidden": false,
    "id": "_clone_yjVN",
    "maxSelect": 1,
    "minSelect": 0,
    "name": "owner",
    "presentable": false,
    "required": true,
    "system": false,
    "type": "relation"
  }))

  // remove field
  collection.fields.removeById("_clone_TXyQ")

  // remove field
  collection.fields.removeById("_clone_P9ma")

  // remove field
  collection.fields.removeById("_clone_IvVW")

  // remove field
  collection.fields.removeById("_clone_sSJE")

  // remove field
  collection.fields.removeById("_clone_atB1")

  return app.save(collection)
})
