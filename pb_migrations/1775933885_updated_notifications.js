/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_2301922722")

  // update collection data
  unmarshal({
    "createRule": "@request.auth.id = recipient || @request.auth.id = relatedId || @request.auth.id = sender"
  }, collection)

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_2301922722")

  // update collection data
  unmarshal({
    "createRule": "@request.auth.id = recipient || @request.auth.id = relatedId"
  }, collection)

  return app.save(collection)
})
