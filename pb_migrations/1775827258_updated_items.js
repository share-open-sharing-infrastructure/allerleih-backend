/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("qyvc6pcix0fuqis")

  // update field
  collection.fields.addAt(8, new Field({
    "hidden": false,
    "id": "select989021800",
    "maxSelect": 3,
    "name": "categories",
    "presentable": false,
    "required": false,
    "system": false,
    "type": "select",
    "values": [
      "Freizeit & Sport",
      "Bücher",
      "Spiele",
      "Küche",
      "Ton & Licht",
      "Elektronik",
      "Für Kinder",
      "Sonstiges",
      "Werkzeug und Garten"
    ]
  }))

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("qyvc6pcix0fuqis")

  // update field
  collection.fields.addAt(8, new Field({
    "hidden": false,
    "id": "select989021800",
    "maxSelect": 3,
    "name": "categories",
    "presentable": false,
    "required": false,
    "system": false,
    "type": "select",
    "values": [
      "Freizeit & Sport",
      "Bücher",
      "Spiele",
      "Küche",
      "Ton & Licht",
      "Elektronik",
      "Für Kinder",
      "Sonstiges",
      "Werkzeug & Garten"
    ]
  }))

  return app.save(collection)
})
