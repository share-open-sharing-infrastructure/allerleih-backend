/// <reference path="../pb_data/types.d.ts" />
migrate((db) => {
  const dao = new Dao(db)
  const collection = dao.findCollectionByNameOrId("qyvc6pcix0fuqis")

  // add
  collection.schema.addField(new SchemaField({
    "system": false,
    "id": "sps0x7bl",
    "name": "place",
    "type": "text",
    "required": false,
    "presentable": false,
    "unique": false,
    "options": {
      "min": null,
      "max": null,
      "pattern": ""
    }
  }))

  return dao.saveCollection(collection)
}, (db) => {
  const dao = new Dao(db)
  const collection = dao.findCollectionByNameOrId("qyvc6pcix0fuqis")

  // remove
  collection.schema.removeField("sps0x7bl")

  return dao.saveCollection(collection)
})
