/// <reference path="../pb_data/types.d.ts" />

/**
 * Creates the `messages` base collection.
 */
migrate((app) => {
    const collection = new Collection({
        "name": "messages",
        "type": "base",
        "system": false,
        "fields": [
            {
                "name": "messageContent",
                "type": "text",
                "required": true,
                "system": false,
            },
            {
                "name": "from",
                "type": "relation",
                "required": true,
                "system": false,
                "options": {
                    "collectionId": "_pb_users_auth_",
                    "cascadeDelete": false,
                    "maxSelect": 1,
                }
            },
            {
                "name": "to",
                "type": "relation",
                "required": true,
                "system": false,
                "options": {
                    "collectionId": "_pb_users_auth_",
                    "cascadeDelete": false,
                    "maxSelect": 1,
                }
            },
        ],
        "indexes": [
            "CREATE INDEX idx_messages_from ON messages (`from`)",
            "CREATE INDEX idx_messages_to ON messages (`to`)",
        ],
        "listRule": "@request.auth.id = from || @request.auth.id = to",
        "viewRule": "@request.auth.id = from || @request.auth.id = to",
        "createRule": "@request.auth.id != '' && @request.body.from = @request.auth.id",
        "updateRule": null,
        "deleteRule": null,
    })

    return app.save(collection)
}, (app) => {
    const collection = app.findCollectionByNameOrId('messages')
    return app.delete(collection)
})
