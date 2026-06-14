/// <reference path="../pb_data/types.d.ts" />

/**
 * Creates the `term_acceptances` base collection.
 */
migrate((app) => {
    const collection = new Collection({
        "name": "term_acceptances",
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
                    "cascadeDelete": false,
                    "maxSelect": 1,
                }
            },
            {
                "name": "terms",
                "type": "relation",
                "required": true,
                "system": false,
                "options": {
                    "collectionId": "lending_terms",
                    "cascadeDelete": false,
                    "maxSelect": 1,
                }
            },
            {
                "name": "acceptedAt",
                "type": "date",
                "required": true,
                "system": false,
            },
            {
                "name": "confirmedAdult",
                "type": "bool",
                "required": false,
                "system": false,
            },
            {
                "name": "fullNameSnapshot",
                "type": "text",
                "required": true,
                "system": false,
            },
            {
                "name": "termsBody",
                "type": "editor",
                "required": true,
                "system": false,
            },
            {
                "name": "termsVersion",
                "type": "text",
                "required": false,
                "system": false,
            },
            {
                "name": "termsTitle",
                "type": "text",
                "required": false,
                "system": false,
            },
            {
                "name": "userIp",
                "type": "text",
                "required": false,
                "system": false,
            },
            {
                "name": "userAgent",
                "type": "text",
                "required": false,
                "system": false,
            },
        ],
        "indexes": [
            "CREATE INDEX idx_term_acceptances_user ON term_acceptances (user)",
            "CREATE INDEX idx_term_acceptances_terms ON term_acceptances (terms)",
            "CREATE UNIQUE INDEX idx_term_acceptances_unique ON term_acceptances (user, terms)",
        ],
        "listRule": "@request.auth.id = user",
        "viewRule": "@request.auth.id = user",
        "createRule": "@request.auth.id != '' && @request.body.user = @request.auth.id",
        "updateRule": null,
        "deleteRule": null,
    })

    return app.save(collection)
}, (app) => {
    const collection = app.findCollectionByNameOrId('term_acceptances')
    return app.delete(collection)
})
