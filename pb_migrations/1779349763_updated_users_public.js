/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_3565108830")

  // update collection data
  unmarshal({
    "viewQuery": "SELECT\n  users.id,\n  users.username,\n  users.bio,\n  users.verified,\n  users.isInstitution,\n  users.profileImage,\n  users.telegramVisibleToTrustedOnly,\n  users.signalVisibleToTrustedOnly,\n  users.created,\n  users.trusts\nFROM users"
  }, collection)

  // remove field
  collection.fields.removeById("_clone_qMwQ")

  // remove field
  collection.fields.removeById("_clone_rGNg")

  // remove field
  collection.fields.removeById("_clone_iTeY")

  // remove field
  collection.fields.removeById("_clone_h9kG")

  // remove field
  collection.fields.removeById("_clone_sKqj")

  // remove field
  collection.fields.removeById("_clone_y2Te")

  // remove field
  collection.fields.removeById("_clone_f3oq")

  // remove field
  collection.fields.removeById("_clone_MS3e")

  // add field
  collection.fields.addAt(1, new Field({
    "autogeneratePattern": "users[0-9]{6}",
    "hidden": false,
    "id": "_clone_6hK4",
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
    "id": "_clone_2JS6",
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
    "id": "_clone_AGTl",
    "name": "verified",
    "presentable": false,
    "required": false,
    "system": true,
    "type": "bool"
  }))

  // add field
  collection.fields.addAt(4, new Field({
    "hidden": false,
    "id": "_clone_Qnv7",
    "name": "isInstitution",
    "presentable": false,
    "required": false,
    "system": false,
    "type": "bool"
  }))

  // add field
  collection.fields.addAt(5, new Field({
    "hidden": false,
    "id": "_clone_wQhm",
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
    "id": "_clone_yIQC",
    "name": "telegramVisibleToTrustedOnly",
    "presentable": false,
    "required": false,
    "system": false,
    "type": "bool"
  }))

  // add field
  collection.fields.addAt(7, new Field({
    "hidden": false,
    "id": "_clone_gEeB",
    "name": "signalVisibleToTrustedOnly",
    "presentable": false,
    "required": false,
    "system": false,
    "type": "bool"
  }))

  // add field
  collection.fields.addAt(8, new Field({
    "hidden": false,
    "id": "_clone_4p2A",
    "name": "created",
    "onCreate": true,
    "onUpdate": false,
    "presentable": false,
    "system": false,
    "type": "autodate"
  }))

  // add field
  collection.fields.addAt(9, new Field({
    "cascadeDelete": false,
    "collectionId": "hbacudkt08pfcy3",
    "hidden": false,
    "id": "_clone_lf4w",
    "maxSelect": 2147483647,
    "minSelect": 0,
    "name": "trusts",
    "presentable": false,
    "required": false,
    "system": false,
    "type": "relation"
  }))

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_3565108830")

  // update collection data
  unmarshal({
    "viewQuery": "SELECT\n  users.id,\n  users.username,\n  users.bio,\n  users.verified,\n  users.isInstitution,\n  users.profileImage,\n  users.telegramVisibleToTrustedOnly,\n  users.signalVisibleToTrustedOnly,\n  users.created\nFROM users"
  }, collection)

  // add field
  collection.fields.addAt(1, new Field({
    "autogeneratePattern": "users[0-9]{6}",
    "hidden": false,
    "id": "_clone_qMwQ",
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
    "id": "_clone_rGNg",
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
    "id": "_clone_iTeY",
    "name": "verified",
    "presentable": false,
    "required": false,
    "system": true,
    "type": "bool"
  }))

  // add field
  collection.fields.addAt(4, new Field({
    "hidden": false,
    "id": "_clone_h9kG",
    "name": "isInstitution",
    "presentable": false,
    "required": false,
    "system": false,
    "type": "bool"
  }))

  // add field
  collection.fields.addAt(5, new Field({
    "hidden": false,
    "id": "_clone_sKqj",
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
    "id": "_clone_y2Te",
    "name": "telegramVisibleToTrustedOnly",
    "presentable": false,
    "required": false,
    "system": false,
    "type": "bool"
  }))

  // add field
  collection.fields.addAt(7, new Field({
    "hidden": false,
    "id": "_clone_f3oq",
    "name": "signalVisibleToTrustedOnly",
    "presentable": false,
    "required": false,
    "system": false,
    "type": "bool"
  }))

  // add field
  collection.fields.addAt(8, new Field({
    "hidden": false,
    "id": "_clone_MS3e",
    "name": "created",
    "onCreate": true,
    "onUpdate": false,
    "presentable": false,
    "system": false,
    "type": "autodate"
  }))

  // remove field
  collection.fields.removeById("_clone_6hK4")

  // remove field
  collection.fields.removeById("_clone_2JS6")

  // remove field
  collection.fields.removeById("_clone_AGTl")

  // remove field
  collection.fields.removeById("_clone_Qnv7")

  // remove field
  collection.fields.removeById("_clone_wQhm")

  // remove field
  collection.fields.removeById("_clone_yIQC")

  // remove field
  collection.fields.removeById("_clone_gEeB")

  // remove field
  collection.fields.removeById("_clone_4p2A")

  // remove field
  collection.fields.removeById("_clone_lf4w")

  return app.save(collection)
})
