/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("hbacudkt08pfcy3")

  // update field
  collection.fields.addAt(22, new Field({
    "autogeneratePattern": "",
    "hidden": true,
    "id": "text4020674105",
    "max": 0,
    "min": 0,
    "name": "leihbackendItemUrlTemplate",
    "pattern": "",
    "presentable": false,
    "primaryKey": false,
    "required": false,
    "system": false,
    "type": "text"
  }))

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("hbacudkt08pfcy3")

  // update field
  collection.fields.addAt(22, new Field({
    "autogeneratePattern": "",
    "hidden": false,
    "id": "text4020674105",
    "max": 0,
    "min": 0,
    "name": "leihbackendItemUrlTemplate",
    "pattern": "",
    "presentable": false,
    "primaryKey": false,
    "required": false,
    "system": false,
    "type": "text"
  }))

  return app.save(collection)
})
