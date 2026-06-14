/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_1703855700")

  // update collection data
  unmarshal({
    "viewQuery": "SELECT\n  users.id,\n  users.username,\n  users.bio,\n  users.profileImage,\n  users.isInstitution,\n  users.trusts\nFROM users"
  }, collection)

  // remove field
  collection.fields.removeById("_clone_VoSH")

  // remove field
  collection.fields.removeById("_clone_noWX")

  // remove field
  collection.fields.removeById("_clone_HXiU")

  // remove field
  collection.fields.removeById("_clone_NyqB")

  // remove field
  collection.fields.removeById("_clone_s69l")

  // remove field
  collection.fields.removeById("_clone_gU0y")

  // add field
  collection.fields.addAt(1, new Field({
    "autogeneratePattern": "users[0-9]{6}",
    "hidden": false,
    "id": "_clone_Apyx",
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
    "id": "_clone_0fTE",
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
    "id": "_clone_deeT",
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
  collection.fields.addAt(4, new Field({
    "hidden": false,
    "id": "_clone_2PV8",
    "name": "isInstitution",
    "presentable": false,
    "required": false,
    "system": false,
    "type": "bool"
  }))

  // add field
  collection.fields.addAt(5, new Field({
    "cascadeDelete": false,
    "collectionId": "hbacudkt08pfcy3",
    "hidden": false,
    "id": "_clone_lNbH",
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
  const collection = app.findCollectionByNameOrId("pbc_1703855700")

  // update collection data
  unmarshal({
    "viewQuery": "SELECT\n  users.id,\n  users.username,\n  users.city,\n  users.bio,\n  users.profileImage,\n  users.isInstitution,\n  users.trusts\nFROM users"
  }, collection)

  // add field
  collection.fields.addAt(1, new Field({
    "autogeneratePattern": "users[0-9]{6}",
    "hidden": false,
    "id": "_clone_VoSH",
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
    "autogeneratePattern": "",
    "hidden": false,
    "id": "_clone_noWX",
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
  collection.fields.addAt(3, new Field({
    "convertURLs": false,
    "hidden": false,
    "id": "_clone_HXiU",
    "maxSize": 0,
    "name": "bio",
    "presentable": false,
    "required": false,
    "system": false,
    "type": "editor"
  }))

  // add field
  collection.fields.addAt(4, new Field({
    "hidden": false,
    "id": "_clone_NyqB",
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
  collection.fields.addAt(5, new Field({
    "hidden": false,
    "id": "_clone_s69l",
    "name": "isInstitution",
    "presentable": false,
    "required": false,
    "system": false,
    "type": "bool"
  }))

  // add field
  collection.fields.addAt(6, new Field({
    "cascadeDelete": false,
    "collectionId": "hbacudkt08pfcy3",
    "hidden": false,
    "id": "_clone_gU0y",
    "maxSelect": 2147483647,
    "minSelect": 0,
    "name": "trusts",
    "presentable": false,
    "required": false,
    "system": false,
    "type": "relation"
  }))

  // remove field
  collection.fields.removeById("_clone_Apyx")

  // remove field
  collection.fields.removeById("_clone_0fTE")

  // remove field
  collection.fields.removeById("_clone_deeT")

  // remove field
  collection.fields.removeById("_clone_2PV8")

  // remove field
  collection.fields.removeById("_clone_lNbH")

  return app.save(collection)
})
