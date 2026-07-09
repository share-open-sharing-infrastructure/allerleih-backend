/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_3920114050")

  // add field — require the borrower to have an address (issue #389)
  collection.fields.addAt(3, new Field({
    "help": "",
    "hidden": false,
    "id": "bool1583242983",
    "name": "requireAddress",
    "presentable": false,
    "required": false,
    "system": false,
    "type": "bool"
  }))

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_3920114050")

  collection.fields.removeById("bool1583242983")

  return app.save(collection)
})
