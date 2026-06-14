/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("hbacudkt08pfcy3")

  // update collection data
  unmarshal({
    "authAlert": {
      "emailTemplate": {
        "subject": "Login von einem neuen Ort"
      }
    }
  }, collection)

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("hbacudkt08pfcy3")

  // update collection data
  unmarshal({
    "authAlert": {
      "emailTemplate": {
        "subject": "Login from a new location"
      }
    }
  }, collection)

  return app.save(collection)
})
