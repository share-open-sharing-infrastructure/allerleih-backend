/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("qyvc6pcix0fuqis")

  // add field
  collection.fields.addAt(11, new Field({
    "autogeneratePattern": "",
    "hidden": false,
    "id": "text3586769666",
    "max": 0,
    "min": 0,
    "name": "externalImgUrl",
    "pattern": "",
    "presentable": false,
    "primaryKey": false,
    "required": false,
    "system": false,
    "type": "text"
  }))

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("qyvc6pcix0fuqis")

  // remove field
  collection.fields.removeById("text3586769666")

  return app.save(collection)
})
