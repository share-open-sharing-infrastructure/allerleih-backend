/// <reference path="../pb_data/types.d.ts" />

// Issue #426: pull `preferredTransportMode` + `hasOnboarded` off the `users` table
// into the existing `user_preferences` sidecar. Step 1 of 3 (add → copy → drop).
migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_2847563901")

  collection.fields.add(new Field({
    "hidden": false,
    "id": "select2087654321",
    "maxSelect": 1,
    "name": "preferredTransportMode",
    "presentable": false,
    "required": false,
    "system": false,
    "type": "select",
    "values": [
      "car",
      "bicycle",
      "foot"
    ]
  }))

  collection.fields.add(new Field({
    "hidden": false,
    "id": "bool2087654322",
    "name": "hasOnboarded",
    "presentable": false,
    "required": false,
    "system": false,
    "type": "bool"
  }))

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_2847563901")

  collection.fields.removeById("select2087654321")
  collection.fields.removeById("bool2087654322")

  return app.save(collection)
})
