/// <reference path="../pb_data/types.d.ts" />

/**
 * Creates the `push_subscriptions` base collection.
 */
migrate((app) => {
    const collection = new Collection({
        "name": "push_subscriptions",
        "type": "base",
        "system": false,
        "fields": [
            {
                "name": "user",
                "type": "relation",
                "required": true,
                "system": false,
                "options": {
                    "collectionId": "_pb_users_auth_",
                    "cascadeDelete": true,
                    "maxSelect": 1,
                }
            },
            {
                "name": "endpoint",
                "type": "url",
                "required": true,
                "system": false,
            },
            {
                "name": "p256dh",
                "type": "text",
                "required": true,
                "system": false,
            },
            {
                "name": "auth",
                "type": "text",
                "required": true,
                "system": false,
            },
        ],
        "indexes": [
            "CREATE INDEX idx_push_user ON push_subscriptions (user)",
            "CREATE UNIQUE INDEX idx_push_endpoint ON push_subscriptions (endpoint)",
        ],
        "listRule": "@request.auth.id = user",
        "viewRule": "@request.auth.id = user",
        "createRule": "@request.auth.id != '' && @request.body.user = @request.auth.id",
        "updateRule": "@request.auth.id = user",
        "deleteRule": "@request.auth.id = user",
    })

    return app.save(collection)
}, (app) => {
    const collection = app.findCollectionByNameOrId('push_subscriptions')
    return app.delete(collection)
})
