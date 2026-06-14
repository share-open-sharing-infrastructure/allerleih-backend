/// <reference path="../pb_data/types.d.ts" />
migrate((db) => {
  const dao = new Dao(db)
  const collection = dao.findCollectionByNameOrId("qyvc6pcix0fuqis")

  collection.createRule = ""

  return dao.saveCollection(collection)
}, (db) => {
  const dao = new Dao(db)
  const collection = dao.findCollectionByNameOrId("qyvc6pcix0fuqis")

  collection.createRule = "@collection.users.email = \"timo.johner@posteo.de\""

  return dao.saveCollection(collection)
})
