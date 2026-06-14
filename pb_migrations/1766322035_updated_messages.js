/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("ozpasmnqgrdxiy6")

  // update collection data
  unmarshal({
    "listRule": ""
  }, collection)

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("ozpasmnqgrdxiy6")

  // update collection data
  unmarshal({
    "listRule": "from = @request.auth.id || to = @request.auth.id"
  }, collection)

  return app.save(collection)
})
