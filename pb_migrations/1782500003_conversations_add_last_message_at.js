/// <reference path="../pb_data/types.d.ts" />

// Add `lastMessageAt` to conversations so the conversation list can sort by actual
// message activity rather than the generic `updated` timestamp (which gets bumped by
// presence heartbeats and other non-message updates).
// Backfill existing conversations with their `updated` value as a reasonable default.

migrate((app) => {
    const collection = app.findCollectionByNameOrId('conversations')

    collection.fields.add(new Field({
        type: 'date',
        id: 'date_last_message_at',
        name: 'lastMessageAt',
        required: false,
        system: false,
    }))

    app.save(collection)

    // Backfill: set lastMessageAt = updated for all existing conversations so the
    // sort order is preserved. Without this, pre-migration conversations have an
    // empty lastMessageAt and sink to the bottom of descending sorts.
    app.db().newQuery('UPDATE conversations SET lastMessageAt = updated WHERE lastMessageAt = ""').execute()
}, (app) => {
    const collection = app.findCollectionByNameOrId('conversations')

    collection.fields.removeById('date_last_message_at')

    return app.save(collection)
})
