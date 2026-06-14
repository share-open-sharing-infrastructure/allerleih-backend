/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_3709231855")

  // update field
  collection.fields.addAt(1, new Field({
    "cascadeDelete": false,
    "collectionId": "hbacudkt08pfcy3",
    "hidden": false,
    "id": "relation1820765950",
    "maxSelect": 1,
    "minSelect": 0,
    "name": "requester",
    "presentable": false,
    "required": true,
    "system": false,
    "type": "relation"
  }))

  // update field
  collection.fields.addAt(2, new Field({
    "cascadeDelete": false,
    "collectionId": "hbacudkt08pfcy3",
    "hidden": false,
    "id": "relation2612329880",
    "maxSelect": 1,
    "minSelect": 0,
    "name": "itemOwner",
    "presentable": false,
    "required": true,
    "system": false,
    "type": "relation"
  }))

  // update field
  collection.fields.addAt(3, new Field({
    "cascadeDelete": false,
    "collectionId": "qyvc6pcix0fuqis",
    "hidden": false,
    "id": "relation3423333186",
    "maxSelect": 1,
    "minSelect": 0,
    "name": "requestedItem",
    "presentable": false,
    "required": true,
    "system": false,
    "type": "relation"
  }))

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_3709231855")

  // update field
  collection.fields.addAt(1, new Field({
    "cascadeDelete": false,
    "collectionId": "hbacudkt08pfcy3",
    "hidden": false,
    "id": "relation1820765950",
    "maxSelect": 1,
    "minSelect": 0,
    "name": "requester",
    "presentable": false,
    "required": false,
    "system": false,
    "type": "relation"
  }))

  // update field
  collection.fields.addAt(2, new Field({
    "cascadeDelete": false,
    "collectionId": "hbacudkt08pfcy3",
    "hidden": false,
    "id": "relation2612329880",
    "maxSelect": 1,
    "minSelect": 0,
    "name": "itemOwner",
    "presentable": false,
    "required": false,
    "system": false,
    "type": "relation"
  }))

  // update field
  collection.fields.addAt(3, new Field({
    "cascadeDelete": false,
    "collectionId": "qyvc6pcix0fuqis",
    "hidden": false,
    "id": "relation3423333186",
    "maxSelect": 1,
    "minSelect": 0,
    "name": "requestedItem",
    "presentable": false,
    "required": false,
    "system": false,
    "type": "relation"
  }))

  return app.save(collection)
})
