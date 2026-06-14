/// <reference path="../pb_data/types.d.ts" />

/**
 * Creates the `notifications` base collection.
 */
migrate((app) => {
    const collection = new Collection({
        "name": "notifications",
        "type": "base",
        "system": false,
        "fields": [
            {
                "name": "recipient",
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
                "name": "sender",
                "type": "relation",
                "required": false,
                "system": false,
                "options": {
                    "collectionId": "_pb_users_auth_",
                    "cascadeDelete": false,
                    "maxSelect": 1,
                }
            },
            {
                "name": "type",
                "type": "select",
                "required": true,
                "system": false,
                "options": {
                    "values": [
                        "new_message",
                        "new_request",
                        "trust_added",
                        "invite_accepted",
                        "request_accepted",
                        "request_rejected",
                        "handover_confirmed",
                        "return_requested",
                        "return_confirmed"
                    ],
                    "maxSelect": 1,
                }
            },
            {
                "name": "relatedId",
                "type": "text",
                "required": true,
                "system": false,
            },
            {
                "name": "body",
                "type": "text",
                "required": true,
                "system": false,
            },
            {
                "name": "read",
                "type": "bool",
                "required": false,
                "system": false,
            },
        ],
        "indexes": [
            "CREATE INDEX idx_notifications_recipient ON notifications (recipient)",
            "CREATE INDEX idx_notifications_read ON notifications (recipient, read)",
        ],
        "listRule": "@request.auth.id = recipient",
        "viewRule": "@request.auth.id = recipient",
        "createRule": "@request.auth.id != ''",
        "updateRule": "@request.auth.id = recipient",
        "deleteRule": "@request.auth.id = recipient",
    })

    return app.save(collection)
}, (app) => {
    const collection = app.findCollectionByNameOrId('notifications')
    return app.delete(collection)
})
