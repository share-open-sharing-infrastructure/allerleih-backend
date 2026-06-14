/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("qyvc6pcix0fuqis")

  // add field
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
      "Werkzeug",
      "Bücher",
      "Spiele",
      "Küche",
      "Ton & Licht",
      "Elektronik",
      "Für Kinder",
      "Sonstiges"
    ]
  }))

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("qyvc6pcix0fuqis")

  // remove field
  collection.fields.removeById("select989021800")

  return app.save(collection)
})
