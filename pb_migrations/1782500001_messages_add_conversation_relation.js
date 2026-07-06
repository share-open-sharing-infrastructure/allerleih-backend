/// <reference path="../pb_data/types.d.ts" />

// Add a `conversation` relation to messages.
// This allows the notification hook to look up the exact conversation for a message
// without relying on an ambiguous participant-pair filter (which fails when two users
// share multiple conversations for different items).

migrate((app) => {
    const collection = app.findCollectionByNameOrId('messages')

    collection.fields.add(new Field({
        type: 'relation',
        id: 'relation_msg_conversation',
        name: 'conversation',
        collectionId: 'pbc_3709231855', // conversations collection
        cascadeDelete: false,
        maxSelect: 1,
        minSelect: 0,
        required: false, // not required to avoid breaking existing messages
        system: false,
    }))

    return app.save(collection)
}, (app) => {
    const collection = app.findCollectionByNameOrId('messages')

    collection.fields.removeById('relation_msg_conversation')

    return app.save(collection)
})
