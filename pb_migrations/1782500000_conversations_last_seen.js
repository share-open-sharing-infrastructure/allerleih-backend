/// <reference path="../pb_data/types.d.ts" />

// Add requesterLastSeenAt and ownerLastSeenAt fields to conversations.
// These are updated by the frontend while a user has the conversation page open,
// allowing the backend to suppress email notifications for actively-viewing users.

migrate((app) => {
    const collection = app.findCollectionByNameOrId('conversations')

    collection.fields.add(new Field({
        type: 'date',
        id: 'date_requester_last_seen',
        name: 'requesterLastSeenAt',
        required: false,
        system: false,
    }))

    collection.fields.add(new Field({
        type: 'date',
        id: 'date_owner_last_seen',
        name: 'ownerLastSeenAt',
        required: false,
        system: false,
    }))

    return app.save(collection)
}, (app) => {
    const collection = app.findCollectionByNameOrId('conversations')

    collection.fields.removeById('date_requester_last_seen')
    collection.fields.removeById('date_owner_last_seen')

    return app.save(collection)
})
