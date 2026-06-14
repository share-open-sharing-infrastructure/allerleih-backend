/// <reference path="../pb_data/types.d.ts" />

/**
 * Creates the `items` base collection.
 */
migrate((app) => {
    const collection = new Collection({
        "name": "items",
        "type": "base",
        "system": false,
        "fields": [
            {
                "name": "name",
                "type": "text",
                "required": true,
                "system": false,
            },
            {
                "name": "image",
                "type": "file",
                "required": false,
                "system": false,
                "options": {
                    "mimeTypes": ["image/png", "image/jpeg", "image/webp"],
                    "maxSelect": 1,
                    "maxSize": 5242880,
                    "thumbs": ["200x200", "400x400"],
                }
            },
            {
                "name": "externalImgUrl",
                "type": "url",
                "required": false,
                "system": false,
            },
            {
                "name": "description",
                "type": "text",
                "required": false,
                "system": false,
            },
            {
                "name": "place",
                "type": "text",
                "required": false,
                "system": false,
            },
            {
                "name": "owner",
                "type": "relation",
                "required": true,
                "system": false,
                "options": {
                    "collectionId": "_pb_users_auth_",
                    "cascadeDelete": true,
                    "maxSelect": 1,
                    "minSelect": null,
                }
            },
            {
                "name": "trusteesOnly",
                "type": "bool",
                "required": false,
                "system": false,
            },
            {
                "name": "categories",
                "type": "select",
                "required": false,
                "system": false,
                "options": {
                    "values": [
                        "tools",
                        "kitchen",
                        "garden",
                        "sports",
                        "electronics",
                        "books",
                        "games",
                        "music",
                        "other"
                    ],
                    "maxSelect": 3,
                }
            },
            {
                "name": "status",
                "type": "select",
                "required": true,
                "system": false,
                "options": {
                    "values": ["available", "unavailable", "unknown"],
                    "maxSelect": 1,
                }
            },
            {
                "name": "externalId",
                "type": "text",
                "required": false,
                "system": false,
            },
            {
                "name": "externalUrl",
                "type": "url",
                "required": false,
                "system": false,
            },
        ],
        "indexes": [
            "CREATE INDEX idx_items_owner ON items (owner)",
            "CREATE INDEX idx_items_status ON items (status)",
            "CREATE INDEX idx_items_name ON items (name)",
            "CREATE UNIQUE INDEX idx_items_external ON items (owner, externalId) WHERE externalId != ''",
        ],
        "listRule": "",
        "viewRule": "",
        "createRule": "@request.auth.id != '' && @request.body.owner = @request.auth.id",
        "updateRule": "@request.auth.id = owner",
        "deleteRule": "@request.auth.id = owner",
    })

    return app.save(collection)
}, (app) => {
    const collection = app.findCollectionByNameOrId('items')
    return app.delete(collection)
})
