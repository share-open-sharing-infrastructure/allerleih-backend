/// <reference path="../pb_data/types.d.ts" />
migrate((db) => {
  const dao = new Dao(db)
  const collection = dao.findCollectionByNameOrId("ozpasmnqgrdxiy6")

  collection.listRule = "from = @request.auth.id || to = @request.auth.id"

  return dao.saveCollection(collection)
}, (db) => {
  const dao = new Dao(db)
  const collection = dao.findCollectionByNameOrId("ozpasmnqgrdxiy6")

  collection.listRule = ""

  return dao.saveCollection(collection)
})
