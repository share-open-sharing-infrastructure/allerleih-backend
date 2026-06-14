/// <reference path="../pb_data/types.d.ts" />

/**
 * Creates the `feedback` base collection.
 */
migrate((app) => {
    const collection = new Collection({
        "name": "feedback",
        "type": "base",
        "system": false,
        "fields": [
            {
                "name": "feedbackMessage",
                "type": "text",
                "required": true,
                "system": false,
            },
            {
                "name": "route",
                "type": "text",
                "required": false,
                "system": false,
            },
            {
                "name": "device",
                "type": "text",
                "required": false,
                "system": false,
            },
            {
                "name": "viewportSize",
                "type": "text",
                "required": false,
                "system": false,
            },
            {
                "name": "browser",
                "type": "text",
                "required": false,
                "system": false,
            },
            {
                "name": "browserVersion",
                "type": "text",
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
    const collection = app.findCollectionByNameOrId('feedback')
    return app.delete(collection)
})
