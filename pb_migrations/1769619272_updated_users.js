/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("hbacudkt08pfcy3")

  // update collection data
  unmarshal({
    "verificationTemplate": {
      "subject": "Verifiziere deine {APP_NAME} email"
    }
  }, collection)

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("hbacudkt08pfcy3")

  // update collection data
  unmarshal({
    "verificationTemplate": {
      "subject": "Verify your {APP_NAME} email"
    }
  }, collection)

  return app.save(collection)
})
