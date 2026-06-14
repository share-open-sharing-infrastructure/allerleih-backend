/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_3565108830")

  // update collection data
  unmarshal({
    "listRule": "",
    "viewRule": ""
  }, collection)

  // remove field
  collection.fields.removeById("_clone_MqJi")

  // remove field
  collection.fields.removeById("_clone_4NDv")

  // remove field
  collection.fields.removeById("_clone_aOOJ")

  // remove field
  collection.fields.removeById("_clone_QEYY")

  // remove field
  collection.fields.removeById("_clone_0lt2")

  // remove field
  collection.fields.removeById("_clone_J31w")

  // add field
  collection.fields.addAt(1, new Field({
    "autogeneratePattern": "users[0-9]{6}",
    "hidden": false,
    "id": "_clone_bt0D",
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
  collection.fields.addAt(2, new Field({
    "convertURLs": false,
    "hidden": false,
    "id": "_clone_TFSd",
    "maxSize": 0,
    "name": "bio",
    "presentable": false,
    "required": false,
    "system": false,
    "type": "editor"
  }))

  // add field
  collection.fields.addAt(3, new Field({
    "hidden": false,
    "id": "_clone_WcLG",
    "name": "verified",
    "presentable": false,
    "required": false,
    "system": true,
    "type": "bool"
  }))

  // add field
  collection.fields.addAt(4, new Field({
    "hidden": false,
    "id": "_clone_FQX1",
    "name": "isInstitution",
    "presentable": false,
    "required": false,
    "system": false,
    "type": "bool"
  }))

  // add field
  collection.fields.addAt(5, new Field({
    "hidden": false,
    "id": "_clone_BRkW",
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
  collection.fields.addAt(6, new Field({
    "hidden": false,
    "id": "_clone_zpYw",
    "name": "created",
    "onCreate": true,
    "onUpdate": false,
    "presentable": false,
    "system": false,
    "type": "autodate"
  }))

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_3565108830")

  // update collection data
  unmarshal({
    "listRule": null,
    "viewRule": null
  }, collection)

  // add field
  collection.fields.addAt(1, new Field({
    "autogeneratePattern": "users[0-9]{6}",
    "hidden": false,
    "id": "_clone_MqJi",
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
  collection.fields.addAt(2, new Field({
    "convertURLs": false,
    "hidden": false,
    "id": "_clone_4NDv",
    "maxSize": 0,
    "name": "bio",
    "presentable": false,
    "required": false,
    "system": false,
    "type": "editor"
  }))

  // add field
  collection.fields.addAt(3, new Field({
    "hidden": false,
    "id": "_clone_aOOJ",
    "name": "verified",
    "presentable": false,
    "required": false,
    "system": true,
    "type": "bool"
  }))

  // add field
  collection.fields.addAt(4, new Field({
    "hidden": false,
    "id": "_clone_QEYY",
    "name": "isInstitution",
    "presentable": false,
    "required": false,
    "system": false,
    "type": "bool"
  }))

  // add field
  collection.fields.addAt(5, new Field({
    "hidden": false,
    "id": "_clone_0lt2",
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
  collection.fields.addAt(6, new Field({
    "hidden": false,
    "id": "_clone_J31w",
    "name": "created",
    "onCreate": true,
    "onUpdate": false,
    "presentable": false,
    "system": false,
    "type": "autodate"
  }))

  // remove field
  collection.fields.removeById("_clone_bt0D")

  // remove field
  collection.fields.removeById("_clone_TFSd")

  // remove field
  collection.fields.removeById("_clone_WcLG")

  // remove field
  collection.fields.removeById("_clone_FQX1")

  // remove field
  collection.fields.removeById("_clone_BRkW")

  // remove field
  collection.fields.removeById("_clone_zpYw")

  return app.save(collection)
})
