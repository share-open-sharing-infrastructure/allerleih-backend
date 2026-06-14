/// <reference path="../pb_data/types.d.ts" />
migrate((db) => {
  const dao = new Dao(db)
  const collection = dao.findCollectionByNameOrId("qyvc6pcix0fuqis")

  // add
  collection.schema.addField(new SchemaField({
    "system": false,
    "id": "pmh5o8zx",
    "name": "description",
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
  collection.schema.removeField("pmh5o8zx")

  return dao.saveCollection(collection)
})
