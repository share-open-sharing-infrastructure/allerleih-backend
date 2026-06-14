/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_542531584")

  // remove field
  collection.fields.removeById("relation521872670")

  // add field
  collection.fields.addAt(2, new Field({
    "autogeneratePattern": "",
    "hidden": false,
    "id": "text616412651",
    "max": 0,
    "min": 0,
    "name": "query",
    "pattern": "",
    "presentable": false,
    "primaryKey": false,
    "required": false,
    "system": false,
    "type": "text"
  }))

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_542531584")

  // add field
  collection.fields.addAt(1, new Field({
    "cascadeDelete": false,
    "collectionId": "qyvc6pcix0fuqis",
    "hidden": false,
    "id": "relation521872670",
    "maxSelect": 1,
    "minSelect": 0,
    "name": "item",
    "presentable": false,
    "required": false,
    "system": false,
    "type": "relation"
  }))

  // remove field
  collection.fields.removeById("text616412651")

  return app.save(collection)
})
