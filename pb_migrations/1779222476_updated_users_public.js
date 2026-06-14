/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_3565108830")

  // update collection data
  unmarshal({
    "viewQuery": "SELECT\n  users.id,\n  users.username,\n  users.bio,\n  users.verified,\n  users.isInstitution,\n  users.profileImage,\n  users.city,\n  users.telegramUsername,\n  users.telegramVisibleToTrustedOnly,\n  users.signalLink,\n  users.signalVisibleToTrustedOnly,\n  users.created\nFROM users"
  }, collection)

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

  // add field
  collection.fields.addAt(1, new Field({
    "autogeneratePattern": "users[0-9]{6}",
    "hidden": false,
    "id": "_clone_nZ4p",
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
    "id": "_clone_NMd6",
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
    "id": "_clone_Hx9T",
    "name": "verified",
    "presentable": false,
    "required": false,
    "system": true,
    "type": "bool"
  }))

  // add field
  collection.fields.addAt(4, new Field({
    "hidden": false,
    "id": "_clone_aoWf",
    "name": "isInstitution",
    "presentable": false,
    "required": false,
    "system": false,
    "type": "bool"
  }))

  // add field
  collection.fields.addAt(5, new Field({
    "hidden": false,
    "id": "_clone_2Du8",
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
    "autogeneratePattern": "",
    "hidden": false,
    "id": "_clone_axsv",
    "max": 0,
    "min": 0,
    "name": "city",
    "pattern": "",
    "presentable": false,
    "primaryKey": false,
    "required": false,
    "system": false,
    "type": "text"
  }))

  // add field
  collection.fields.addAt(7, new Field({
    "autogeneratePattern": "",
    "hidden": false,
    "id": "_clone_FWpo",
    "max": 0,
    "min": 0,
    "name": "telegramUsername",
    "pattern": "",
    "presentable": false,
    "primaryKey": false,
    "required": false,
    "system": false,
    "type": "text"
  }))

  // add field
  collection.fields.addAt(8, new Field({
    "hidden": false,
    "id": "_clone_mg0k",
    "name": "telegramVisibleToTrustedOnly",
    "presentable": false,
    "required": false,
    "system": false,
    "type": "bool"
  }))

  // add field
  collection.fields.addAt(9, new Field({
    "autogeneratePattern": "",
    "hidden": false,
    "id": "_clone_1kE1",
    "max": 0,
    "min": 0,
    "name": "signalLink",
    "pattern": "",
    "presentable": false,
    "primaryKey": false,
    "required": false,
    "system": false,
    "type": "text"
  }))

  // add field
  collection.fields.addAt(10, new Field({
    "hidden": false,
    "id": "_clone_zDfk",
    "name": "signalVisibleToTrustedOnly",
    "presentable": false,
    "required": false,
    "system": false,
    "type": "bool"
  }))

  // add field
  collection.fields.addAt(11, new Field({
    "hidden": false,
    "id": "_clone_pqdH",
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
    "viewQuery": "SELECT users.id, users.username, users.bio, users.verified, users.isInstitution, users.profileImage, users.created\nFROM users"
  }, collection)

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

  // remove field
  collection.fields.removeById("_clone_nZ4p")

  // remove field
  collection.fields.removeById("_clone_NMd6")

  // remove field
  collection.fields.removeById("_clone_Hx9T")

  // remove field
  collection.fields.removeById("_clone_aoWf")

  // remove field
  collection.fields.removeById("_clone_2Du8")

  // remove field
  collection.fields.removeById("_clone_axsv")

  // remove field
  collection.fields.removeById("_clone_FWpo")

  // remove field
  collection.fields.removeById("_clone_mg0k")

  // remove field
  collection.fields.removeById("_clone_1kE1")

  // remove field
  collection.fields.removeById("_clone_zDfk")

  // remove field
  collection.fields.removeById("_clone_pqdH")

  return app.save(collection)
})
