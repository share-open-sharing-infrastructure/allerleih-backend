/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("hbacudkt08pfcy3")

  // add field
  collection.fields.addAt(10, new Field({
    "autogeneratePattern": "",
    "hidden": false,
    "id": "text774300842",
    "max": 0,
    "min": 0,
    "name": "telegramUsername",
    "pattern": "",
    "presentable": false,
    "primaryKey": false,
    "required": false,
    "system": false,
    "type": "text"
  }))

  // add field
  collection.fields.addAt(11, new Field({
    "hidden": false,
    "id": "bool840764222",
    "name": "telegramVisibleToTrustedOnly",
    "presentable": false,
    "required": false,
    "system": false,
    "type": "bool"
  }))

  // add field
  collection.fields.addAt(12, new Field({
    "autogeneratePattern": "",
    "hidden": false,
    "id": "text656625768",
    "max": 0,
    "min": 0,
    "name": "signalLink",
    "pattern": "",
    "presentable": false,
    "primaryKey": false,
    "required": false,
    "system": false,
    "type": "text"
  }))

  // add field
  collection.fields.addAt(13, new Field({
    "hidden": false,
    "id": "bool604880339",
    "name": "signalVisibleToTrustedOnly",
    "presentable": false,
    "required": false,
    "system": false,
    "type": "bool"
  }))

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("hbacudkt08pfcy3")

  // remove field
  collection.fields.removeById("text774300842")

  // remove field
  collection.fields.removeById("bool840764222")

  // remove field
  collection.fields.removeById("text656625768")

  // remove field
  collection.fields.removeById("bool604880339")

  return app.save(collection)
})
