/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("hbacudkt08pfcy3")

  // add field
  collection.fields.addAt(18, new Field({
    "hidden": false,
    "id": "bool37905390",
    "name": "isInstitution",
    "presentable": false,
    "required": false,
    "system": false,
    "type": "bool"
  }))

  // add field
  collection.fields.addAt(19, new Field({
    "hidden": false,
    "id": "file4010923220",
    "maxSelect": 1,
    "maxSize": 0,
    "mimeTypes": [],
    "name": "profileImage",
    "presentable": false,
    "protected": false,
    "required": false,
    "system": false,
    "thumbs": [],
    "type": "file"
  }))

  // add field
  collection.fields.addAt(20, new Field({
    "convertURLs": false,
    "hidden": false,
    "id": "editor3709889147",
    "maxSize": 0,
    "name": "bio",
    "presentable": false,
    "required": false,
    "system": false,
    "type": "editor"
  }))

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("hbacudkt08pfcy3")

  // remove field
  collection.fields.removeById("bool37905390")

  // remove field
  collection.fields.removeById("file4010923220")

  // remove field
  collection.fields.removeById("editor3709889147")

  return app.save(collection)
})
