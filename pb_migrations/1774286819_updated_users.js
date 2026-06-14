/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("hbacudkt08pfcy3")

  // add field
  collection.fields.addAt(14, new Field({
    "hidden": false,
    "id": "select1776134756",
    "maxSelect": 1,
    "name": "preferredTransportMode",
    "presentable": false,
    "required": false,
    "system": false,
    "type": "select",
    "values": [
      "car",
      "bicycle",
      "foot"
    ]
  }))

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("hbacudkt08pfcy3")

  // remove field
  collection.fields.removeById("select1776134756")

  return app.save(collection)
})
