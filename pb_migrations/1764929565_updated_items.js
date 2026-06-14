/// <reference path="../pb_data/types.d.ts" />
migrate((db) => {
  const dao = new Dao(db)
  const collection = dao.findCollectionByNameOrId("qyvc6pcix0fuqis")

  // add
  collection.schema.addField(new SchemaField({
    "system": false,
    "id": "bn1ywrfg",
    "name": "trusteesOnly",
    "type": "bool",
    "required": false,
    "presentable": false,
    "unique": false,
    "options": {}
  }))

  return dao.saveCollection(collection)
}, (db) => {
  const dao = new Dao(db)
  const collection = dao.findCollectionByNameOrId("qyvc6pcix0fuqis")

  // remove
  collection.schema.removeField("bn1ywrfg")

  return dao.saveCollection(collection)
})
