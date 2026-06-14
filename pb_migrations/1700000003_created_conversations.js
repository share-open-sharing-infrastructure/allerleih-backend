/// <reference path="../pb_data/types.d.ts" />

/**
 * Creates the `conversations` base collection.
 */
migrate((app) => {
    const collection = new Collection({
        "name": "conversations",
        "type": "base",
        "system": false,
        "fields": [
            {
                "name": "requester",
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
                "name": "itemOwner",
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
                "name": "requestedItem",
                "type": "relation",
                "required": true,
                "system": false,
                "options": {
                    "collectionId": "items",
                    "cascadeDelete": false,
                    "maxSelect": 1,
                }
            },
            {
                "name": "messages",
                "type": "relation",
                "required": false,
                "system": false,
                "options": {
                    "collectionId": "messages",
                    "cascadeDelete": true,
                    "maxSelect": null,
                }
            },
            {
                "name": "readByRequester",
                "type": "bool",
                "required": false,
                "system": false,
            },
            {
                "name": "readByOwner",
                "type": "bool",
                "required": false,
                "system": false,
            },
            {
                "name": "lendingStatus",
                "type": "select",
                "required": false,
                "system": false,
                "options": {
                    "values": ["pending", "accepted", "rejected", "active", "return_requested", "completed"],
                    "maxSelect": 1,
                }
            },
            {
                "name": "counterfactual",
                "type": "select",
                "required": false,
                "system": false,
                "options": {
                    "values": ["pending", "would_buy", "not_important", "too_expensive", "borrow_elsewhere", "unsure", "skipped"],
                    "maxSelect": 1,
                }
            },
        ],
        "indexes": [
            "CREATE INDEX idx_conversations_requester ON conversations (requester)",
            "CREATE INDEX idx_conversations_owner ON conversations (itemOwner)",
            "CREATE INDEX idx_conversations_item ON conversations (requestedItem)",
            "CREATE INDEX idx_conversations_status ON conversations (lendingStatus)",
        ],
        "listRule": "@request.auth.id = requester || @request.auth.id = itemOwner",
        "viewRule": "@request.auth.id = requester || @request.auth.id = itemOwner",
        "createRule": "@request.auth.id != '' && @request.body.requester = @request.auth.id",
        "updateRule": "@request.auth.id = requester || @request.auth.id = itemOwner",
        "deleteRule": null,
    })

    return app.save(collection)
}, (app) => {
    const collection = app.findCollectionByNameOrId('conversations')
    return app.delete(collection)
})
