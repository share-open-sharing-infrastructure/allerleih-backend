/// <reference path="../pb_data/types.d.ts" />

/**
 * Creates the `searches` base collection (search analytics).
 */
migrate((app) => {
    const collection = new Collection({
        "name": "searches",
        "type": "base",
        "system": false,
        "fields": [
            {
                "name": "query",
                "type": "text",
                "required": false,
                "system": false,
            },
            {
                "name": "categories",
                "type": "json",
                "required": false,
                "system": false,
            },
            {
                "name": "resultCount",
                "type": "number",
                "required": false,
                "system": false,
            },
        ],
        "indexes": [],
        "listRule": null,
        "viewRule": null,
        "createRule": "",
        "updateRule": null,
        "deleteRule": null,
    })

    return app.save(collection)
}, (app) => {
    const collection = app.findCollectionByNameOrId('searches')
    return app.delete(collection)
})
