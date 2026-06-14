/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_3709231855")

  // add field
  collection.fields.addAt(7, new Field({
    "hidden": false,
    "id": "json2419810365",
    "maxSize": 0,
    "name": "messagesObject",
    "presentable": false,
    "required": false,
    "system": false,
    "type": "json"
  }))

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_3709231855")

  // remove field
  collection.fields.removeById("json2419810365")

  return app.save(collection)
})
