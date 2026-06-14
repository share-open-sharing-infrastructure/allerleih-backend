/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_3709231855")

  // update collection data
  unmarshal({
    "name": "conversations"
  }, collection)

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_3709231855")

  // update collection data
  unmarshal({
    "name": "conversation"
  }, collection)

  return app.save(collection)
})
