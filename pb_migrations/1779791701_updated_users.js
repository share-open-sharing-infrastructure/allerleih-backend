/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("hbacudkt08pfcy3")

  // update field
  collection.fields.addAt(6, new Field({
    "autogeneratePattern": "users[0-9]{6}",
    "hidden": false,
    "id": "text4166911607",
    "max": 25,
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
  const collection = app.findCollectionByNameOrId("hbacudkt08pfcy3")

  // update field
  collection.fields.addAt(6, new Field({
    "autogeneratePattern": "users[0-9]{6}",
    "hidden": false,
    "id": "text4166911607",
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
})
