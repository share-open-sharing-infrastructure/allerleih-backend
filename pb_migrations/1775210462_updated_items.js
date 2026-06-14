/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("qyvc6pcix0fuqis")

  // update collection data
  unmarshal({
    "deleteRule": "@request.auth.id = owner"
  }, collection)

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("qyvc6pcix0fuqis")

  // update collection data
  unmarshal({
    "deleteRule": ""
  }, collection)

  return app.save(collection)
})
