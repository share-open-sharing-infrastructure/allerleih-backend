/// <reference path="../pb_data/types.d.ts" />
migrate((db) => {
  const dao = new Dao(db)
  const collection = dao.findCollectionByNameOrId("hbacudkt08pfcy3")

  // add
  collection.schema.addField(new SchemaField({
    "system": false,
    "id": "ng0aklsf",
    "name": "trusts",
    "type": "relation",
    "required": false,
    "presentable": false,
    "unique": false,
    "options": {
      "collectionId": "hbacudkt08pfcy3",
      "cascadeDelete": false,
      "minSelect": null,
      "maxSelect": null,
      "displayFields": null
    }
  }))

  return dao.saveCollection(collection)
}, (db) => {
  const dao = new Dao(db)
  const collection = dao.findCollectionByNameOrId("hbacudkt08pfcy3")

  // remove
  collection.schema.removeField("ng0aklsf")

  return dao.saveCollection(collection)
})
