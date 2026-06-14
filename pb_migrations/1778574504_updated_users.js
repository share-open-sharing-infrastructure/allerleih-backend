/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("hbacudkt08pfcy3")

  // update collection data
  unmarshal({
    "updateRule": "  @request.auth.id = id && @request.body.isInstitution:isset = false"
  }, collection)

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("hbacudkt08pfcy3")

  // update collection data
  unmarshal({
    "updateRule": "@request.auth.id = id"
  }, collection)

  return app.save(collection)
})
