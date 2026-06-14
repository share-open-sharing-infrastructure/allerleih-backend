/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_3565108830")

  // update collection data
  unmarshal({
    "viewQuery": "SELECT users.id, users.username, users.bio\nFROM users"
  }, collection)

  // remove field
  collection.fields.removeById("_clone_o1vb")

  // add field
  collection.fields.addAt(1, new Field({
    "autogeneratePattern": "users[0-9]{6}",
    "hidden": false,
    "id": "_clone_gYsG",
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
    "id": "_clone_cjCh",
    "maxSize": 0,
    "name": "bio",
    "presentable": false,
    "required": false,
    "system": false,
    "type": "editor"
  }))

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_3565108830")

  // update collection data
  unmarshal({
    "viewQuery": "SELECT users.id, users.bio\nFROM users"
  }, collection)

  // add field
  collection.fields.addAt(1, new Field({
    "convertURLs": false,
    "hidden": false,
    "id": "_clone_o1vb",
    "maxSize": 0,
    "name": "bio",
    "presentable": false,
    "required": false,
    "system": false,
    "type": "editor"
  }))

  // remove field
  collection.fields.removeById("_clone_gYsG")

  // remove field
  collection.fields.removeById("_clone_cjCh")

  return app.save(collection)
})
