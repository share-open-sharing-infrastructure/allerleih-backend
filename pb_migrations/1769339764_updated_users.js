/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("hbacudkt08pfcy3")

  // update field
  collection.fields.addAt(8, new Field({
    "hidden": false,
    "id": "geoPoint1587448267",
    "name": "geolocation",
    "presentable": false,
    "required": false,
    "system": false,
    "type": "geoPoint"
  }))

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("hbacudkt08pfcy3")

  // update field
  collection.fields.addAt(8, new Field({
    "hidden": false,
    "id": "geoPoint1587448267",
    "name": "location",
    "presentable": false,
    "required": false,
    "system": false,
    "type": "geoPoint"
  }))

  return app.save(collection)
})
