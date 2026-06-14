/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_3709231855")

  // update collection data
  unmarshal({
    "viewRule": "@request.auth.id = itemOwner"
  }, collection)

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_3709231855")

  // update collection data
  unmarshal({
    "viewRule": "@request.auth.id = itemOwner || @request.auth.id = requester"
  }, collection)

  return app.save(collection)
})
