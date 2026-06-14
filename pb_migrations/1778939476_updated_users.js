/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("hbacudkt08pfcy3")

  // remove field
  collection.fields.removeById("bool2885873740")

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("hbacudkt08pfcy3")

  // add field
  collection.fields.addAt(21, new Field({
    "hidden": false,
    "id": "bool2885873740",
    "name": "finishedOnboarding",
    "presentable": false,
    "required": false,
    "system": false,
    "type": "bool"
  }))

  return app.save(collection)
})
