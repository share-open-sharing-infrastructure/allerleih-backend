/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_3565108830")

  // update collection data
  unmarshal({
    "viewQuery": "SELECT\n  users.id,\n  users.username,\n  users.bio,\n  users.verified,\n  users.isInstitution,\n  users.profileImage,\n  users.telegramVisibleToTrustedOnly,\n  users.signalVisibleToTrustedOnly,\n  users.created\nFROM users"
  }, collection)

  // remove field
  collection.fields.removeById("_clone_7TLr")

  // remove field
  collection.fields.removeById("_clone_QPEJ")

  // remove field
  collection.fields.removeById("_clone_rPvg")

  // remove field
  collection.fields.removeById("_clone_rKqm")

  // remove field
  collection.fields.removeById("_clone_Z2yz")

  // remove field
  collection.fields.removeById("_clone_HVhT")

  // remove field
  collection.fields.removeById("_clone_Kghx")

  // remove field
  collection.fields.removeById("_clone_JxV9")

  // remove field
  collection.fields.removeById("_clone_d9zf")

  // remove field
  collection.fields.removeById("_clone_6bSX")

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

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_3565108830")

  // update collection data
  unmarshal({
    "viewQuery": "SELECT\n  users.id,\n  users.username,\n  users.bio,\n  users.verified,\n  users.isInstitution,\n  users.profileImage,\n  users.telegramUsername,\n  users.telegramVisibleToTrustedOnly,\n  users.signalLink,\n  users.signalVisibleToTrustedOnly,\n  users.created\nFROM users"
  }, collection)

  // add field
  collection.fields.addAt(1, new Field({
    "autogeneratePattern": "users[0-9]{6}",
    "hidden": false,
    "id": "_clone_7TLr",
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
    "id": "_clone_QPEJ",
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
    "id": "_clone_rPvg",
    "name": "verified",
    "presentable": false,
    "required": false,
    "system": true,
    "type": "bool"
  }))

  // add field
  collection.fields.addAt(4, new Field({
    "hidden": false,
    "id": "_clone_rKqm",
    "name": "isInstitution",
    "presentable": false,
    "required": false,
    "system": false,
    "type": "bool"
  }))

  // add field
  collection.fields.addAt(5, new Field({
    "hidden": false,
    "id": "_clone_Z2yz",
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
    "id": "_clone_HVhT",
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
  collection.fields.addAt(7, new Field({
    "hidden": false,
    "id": "_clone_Kghx",
    "name": "telegramVisibleToTrustedOnly",
    "presentable": false,
    "required": false,
    "system": false,
    "type": "bool"
  }))

  // add field
  collection.fields.addAt(8, new Field({
    "autogeneratePattern": "",
    "hidden": false,
    "id": "_clone_JxV9",
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
  collection.fields.addAt(9, new Field({
    "hidden": false,
    "id": "_clone_d9zf",
    "name": "signalVisibleToTrustedOnly",
    "presentable": false,
    "required": false,
    "system": false,
    "type": "bool"
  }))

  // add field
  collection.fields.addAt(10, new Field({
    "hidden": false,
    "id": "_clone_6bSX",
    "name": "created",
    "onCreate": true,
    "onUpdate": false,
    "presentable": false,
    "system": false,
    "type": "autodate"
  }))

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

  return app.save(collection)
})
