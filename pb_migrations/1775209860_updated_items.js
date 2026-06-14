/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("qyvc6pcix0fuqis")

  // update collection data
  unmarshal({
    "updateRule": "@request.auth.id = owner"
  }, collection)

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("qyvc6pcix0fuqis")

  // update collection data
  unmarshal({
    "updateRule": ""
  }, collection)

  return app.save(collection)
})
