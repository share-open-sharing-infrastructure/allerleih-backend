/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_1703855700")

  // update collection data
  unmarshal({
    "viewQuery": "SELECT\n  users.id,\n  users.username,\n  users.bio,\n  users.geolocation,\n  users.profileImage,\n  users.isInstitution,\n  users.trusts\nFROM users"
  }, collection)

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

  // add field
  collection.fields.addAt(1, new Field({
    "autogeneratePattern": "users[0-9]{6}",
    "hidden": false,
    "id": "_clone_Gogk",
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
    "id": "_clone_yqGf",
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
    "id": "_clone_I3Ou",
    "name": "geolocation",
    "presentable": false,
    "required": false,
    "system": false,
    "type": "geoPoint"
  }))

  // add field
  collection.fields.addAt(4, new Field({
    "hidden": false,
    "id": "_clone_F78a",
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
    "id": "_clone_94ZH",
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
    "id": "_clone_q9mH",
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
    "viewQuery": "SELECT\n  users.id,\n  users.username,\n  users.bio,\n  users.profileImage,\n  users.isInstitution,\n  users.trusts\nFROM users"
  }, collection)

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

  // remove field
  collection.fields.removeById("_clone_Gogk")

  // remove field
  collection.fields.removeById("_clone_yqGf")

  // remove field
  collection.fields.removeById("_clone_I3Ou")

  // remove field
  collection.fields.removeById("_clone_F78a")

  // remove field
  collection.fields.removeById("_clone_94ZH")

  // remove field
  collection.fields.removeById("_clone_q9mH")

  return app.save(collection)
})
