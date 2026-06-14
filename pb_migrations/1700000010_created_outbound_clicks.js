/// <reference path="../pb_data/types.d.ts" />

/**
 * Creates the `outbound_clicks` base collection.
 */
migrate((app) => {
    const collection = new Collection({
        "name": "outbound_clicks",
        "type": "base",
        "system": false,
        "fields": [
            {
                "name": "destination",
                "type": "url",
                "required": true,
                "system": false,
            },
            {
                "name": "source_page",
                "type": "text",
                "required": false,
                "system": false,
            },
            {
                "name": "item",
                "type": "relation",
                "required": false,
                "system": false,
                "options": {
                    "collectionId": "items",
                    "cascadeDelete": false,
                    "maxSelect": 1,
                }
            },
        ],
        "indexes": [
            "CREATE INDEX idx_outbound_destination ON outbound_clicks (destination)",
        ],
        "listRule": null,
        "viewRule": null,
        "createRule": "",
        "updateRule": null,
        "deleteRule": null,
    })

    return app.save(collection)
}, (app) => {
    const collection = app.findCollectionByNameOrId('outbound_clicks')
    return app.delete(collection)
})
