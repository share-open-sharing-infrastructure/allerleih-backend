/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("qyvc6pcix0fuqis")

  // update collection data
  unmarshal({
    "createRule": "@request.auth.id != \"\" && (@request.body.externalUrl = \"\" || @request.auth.isInstitution = true)",
    "updateRule": "@request.auth.id = owner && (@request.body.externalUrl = \"\" || @request.auth.isInstitution = true)"
  }, collection)

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("qyvc6pcix0fuqis")

  // update collection data
  unmarshal({
    "createRule": "@request.auth.id != \"\"",
    "updateRule": "@request.auth.id = owner"
  }, collection)

  return app.save(collection)
})
