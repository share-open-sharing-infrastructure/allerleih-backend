/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("ozpasmnqgrdxiy6")

  // update field
  collection.fields.addAt(2, new Field({
    "cascadeDelete": false,
    "collectionId": "hbacudkt08pfcy3",
    "hidden": false,
    "id": "eysfi4lp",
    "maxSelect": 1,
    "minSelect": 0,
    "name": "from",
    "presentable": false,
    "required": true,
    "system": false,
    "type": "relation"
  }))

  // update field
  collection.fields.addAt(3, new Field({
    "cascadeDelete": false,
    "collectionId": "hbacudkt08pfcy3",
    "hidden": false,
    "id": "lnh8coxs",
    "maxSelect": 1,
    "minSelect": 0,
    "name": "to",
    "presentable": false,
    "required": true,
    "system": false,
    "type": "relation"
  }))

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("ozpasmnqgrdxiy6")

  // update field
  collection.fields.addAt(2, new Field({
    "cascadeDelete": false,
    "collectionId": "hbacudkt08pfcy3",
    "hidden": false,
    "id": "eysfi4lp",
    "maxSelect": 1,
    "minSelect": 0,
    "name": "from",
    "presentable": false,
    "required": false,
    "system": false,
    "type": "relation"
  }))

  // update field
  collection.fields.addAt(3, new Field({
    "cascadeDelete": false,
    "collectionId": "hbacudkt08pfcy3",
    "hidden": false,
    "id": "lnh8coxs",
    "maxSelect": 1,
    "minSelect": 0,
    "name": "to",
    "presentable": false,
    "required": false,
    "system": false,
    "type": "relation"
  }))

  return app.save(collection)
})
