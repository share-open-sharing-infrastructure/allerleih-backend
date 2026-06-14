/// <reference path="../pb_data/types.d.ts" />

/**
 * Creates the `lending_terms` base collection.
 */
migrate((app) => {
    const collection = new Collection({
        "name": "lending_terms",
        "type": "base",
        "system": false,
        "fields": [
            {
                "name": "owner",
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
                "name": "version",
                "type": "text",
                "required": true,
                "system": false,
            },
            {
                "name": "title",
                "type": "text",
                "required": true,
                "system": false,
            },
            {
                "name": "body",
                "type": "editor",
                "required": true,
                "system": false,
            },
            {
                "name": "effectiveFrom",
                "type": "date",
                "required": true,
                "system": false,
            },
            {
                "name": "active",
                "type": "bool",
                "required": false,
                "system": false,
            },
            {
                "name": "minAge",
                "type": "number",
                "required": false,
                "system": false,
                "options": {
                    "min": 0,
                    "max": 99,
                }
            },
            {
                "name": "contactPerson",
                "type": "text",
                "required": false,
                "system": false,
            },
        ],
        "indexes": [
            "CREATE INDEX idx_lending_terms_owner ON lending_terms (owner)",
            "CREATE INDEX idx_lending_terms_active ON lending_terms (owner, active)",
        ],
        "listRule": "",
        "viewRule": "",
        "createRule": null,
        "updateRule": null,
        "deleteRule": null,
    })

    return app.save(collection)
}, (app) => {
    const collection = app.findCollectionByNameOrId('lending_terms')
    return app.delete(collection)
})
