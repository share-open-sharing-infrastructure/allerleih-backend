/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_2301922722")

  // update collection data
  unmarshal({
    "createRule": "@request.auth.id = recipient ",
    "deleteRule": "@request.auth.id = recipient ",
    "listRule": "@request.auth.id = recipient ",
    "updateRule": "@request.auth.id = recipient ",
    "viewRule": "@request.auth.id = recipient "
  }, collection)

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_2301922722")

  // update collection data
  unmarshal({
    "createRule": "",
    "deleteRule": "",
    "listRule": "",
    "updateRule": "",
    "viewRule": ""
  }, collection)

  return app.save(collection)
})
