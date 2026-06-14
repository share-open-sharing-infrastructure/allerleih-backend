/// <reference path="../pb_data/types.d.ts" />

/**
 * Notification hooks — handle side-effects when notifications-relevant events occur.
 *
 * This is a scaffold showing the pattern. Uncomment and adapt when ready
 * to migrate notification logic from SvelteKit to PocketBase hooks.
 */

// Example: Send push notification when a new message is created
// onRecordAfterCreateSuccess((e) => {
//     const { DRY_MODE } = require(`${__hooks}/constants.js`)
//     const { createNotification } = require(`${__hooks}/services/notification.js`)
//
//     if (DRY_MODE) return
//
//     const message = e.record
//     const recipientId = message.get('to')
//     const senderId = message.get('from')
//
//     // Create in-app notification
//     createNotification($app, {
//         recipient: recipientId,
//         sender: senderId,
//         type: 'new_message',
//         relatedId: message.id,
//         body: 'Du hast eine neue Nachricht erhalten.',
//     })
//
//     // TODO: Send push notification
// }, 'messages')

// Example: Cron job to clean stale push subscriptions (daily at 3 AM)
// cronAdd('clean_stale_subscriptions', '0 3 * * *', () => {
//     $app.logger().info('[cron] Cleaning stale push subscriptions...')
//     // TODO: Implement stale subscription cleanup
// })
