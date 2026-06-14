/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("ozpasmnqgrdxiy6")

  // update collection data
  unmarshal({
    "createRule": "@request.auth.id != \"\"",
    "deleteRule": "@request.auth.id = from || @request.auth.id = to",
    "listRule": "@request.auth.id = from || @request.auth.id = to ",
    "updateRule": "@request.auth.id = from || @request.auth.id = to",
    "viewRule": "@request.auth.id = from || @request.auth.id = to "
  }, collection)

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("ozpasmnqgrdxiy6")

  // update collection data
  unmarshal({
    "createRule": "",
    "deleteRule": null,
    "listRule": "",
    "updateRule": null,
    "viewRule": ""
  }, collection)

  return app.save(collection)
})
