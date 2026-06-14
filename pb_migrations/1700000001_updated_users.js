/// <reference path="../pb_data/types.d.ts" />

/**
 * Updates the users auth collection with AllerLeih-specific fields.
 *
 * NOTE: The `users` collection already exists as a default PocketBase auth collection.
 * This migration adds the custom fields needed by AllerLeih.
 */
migrate((app) => {
    const collection = app.findCollectionByNameOrId('users')

    // Add custom fields
    collection.fields.add(new Field({
        "name": "city",
        "type": "text",
        "required": false,
        "system": false,
    }))

    collection.fields.add(new Field({
        "name": "trusts",
        "type": "relation",
        "required": false,
        "system": false,
        "options": {
            "collectionId": collection.id,
            "cascadeDelete": false,
            "maxSelect": null,
            "minSelect": null,
        }
    }))

    collection.fields.add(new Field({
        "name": "telegramUsername",
        "type": "text",
        "required": false,
        "system": false,
    }))

    collection.fields.add(new Field({
        "name": "telegramVisibleToTrustedOnly",
        "type": "bool",
        "required": false,
        "system": false,
    }))

    collection.fields.add(new Field({
        "name": "signalLink",
        "type": "text",
        "required": false,
        "system": false,
    }))

    collection.fields.add(new Field({
        "name": "signalVisibleToTrustedOnly",
        "type": "bool",
        "required": false,
        "system": false,
    }))

    collection.fields.add(new Field({
        "name": "geolocation",
        "type": "json",
        "required": false,
        "system": false,
    }))

    collection.fields.add(new Field({
        "name": "preferredTransportMode",
        "type": "select",
        "required": false,
        "system": false,
        "options": {
            "values": ["foot", "bicycle", "car"],
            "maxSelect": 1,
        }
    }))

    collection.fields.add(new Field({
        "name": "inviteCode",
        "type": "text",
        "required": false,
        "system": false,
    }))

    collection.fields.add(new Field({
        "name": "invitedBy",
        "type": "relation",
        "required": false,
        "system": false,
        "options": {
            "collectionId": collection.id,
            "cascadeDelete": false,
            "maxSelect": 1,
            "minSelect": null,
        }
    }))

    collection.fields.add(new Field({
        "name": "hasOnboarded",
        "type": "bool",
        "required": false,
        "system": false,
    }))

    collection.fields.add(new Field({
        "name": "isInstitution",
        "type": "bool",
        "required": false,
        "system": false,
    }))

    collection.fields.add(new Field({
        "name": "profileImage",
        "type": "file",
        "required": false,
        "system": false,
        "options": {
            "mimeTypes": ["image/png", "image/jpeg", "image/webp"],
            "maxSelect": 1,
            "maxSize": 5242880,
            "thumbs": ["100x100", "300x300"],
        }
    }))

    collection.fields.add(new Field({
        "name": "bio",
        "type": "text",
        "required": false,
        "system": false,
    }))

    return app.save(collection)
}, (app) => {
    // Revert: remove custom fields (reverse order)
    const collection = app.findCollectionByNameOrId('users')
    const fieldsToRemove = [
        'bio', 'profileImage', 'isInstitution', 'hasOnboarded',
        'invitedBy', 'inviteCode', 'preferredTransportMode',
        'geolocation', 'signalVisibleToTrustedOnly', 'signalLink',
        'telegramVisibleToTrustedOnly', 'telegramUsername', 'trusts', 'city'
    ]
    for (const name of fieldsToRemove) {
        collection.fields.removeByName(name)
    }
    return app.save(collection)
})
