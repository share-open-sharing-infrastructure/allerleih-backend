/// <reference path="../../pb_data/types.d.ts" />

/**
 * Notification service — creates in-app notifications and sends push notifications.
 *
 * TODO: Migrate push notification logic from the SvelteKit frontend
 * (src/lib/server/notifications.ts) into this service.
 *
 * Future responsibilities:
 * - createNotification(recipient, sender, type, relatedId, body)
 * - sendPushToUser(userId, payload)
 * - isThrottled(recipientId, conversationId) -- 60s cooldown
 * - cleanStalePushSubscriptions()
 */

/**
 * Creates an in-app notification record.
 */
function createNotification(app, { recipient, sender, type, relatedId, body }) {
    const collection = app.findCollectionByNameOrId('notifications')
    const record = new Record(collection)

    record.set('recipient', recipient)
    record.set('sender', sender || '')
    record.set('type', type)
    record.set('relatedId', relatedId)
    record.set('body', body)
    record.set('read', false)

    app.save(record)

    return record
}

module.exports = {
    createNotification,
}
