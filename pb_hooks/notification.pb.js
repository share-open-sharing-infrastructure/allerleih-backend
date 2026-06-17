/// <reference path="../pb_data/types.d.ts" />

/**
 * Notification hooks — handle side-effects when notifications-relevant events occur.
 *
 * When a new message is created:
 * 1. Creates an in-app notification (always)
 * 2. Sends an email notification (throttled: max 1 per recipient per MAIL_THROTTLE_MINUTES)
 */

onRecordAfterCreateSuccess((e) => {
    const { DRY_MODE, MAIL_THROTTLE_MINUTES } = require(`${__hooks}/constants.js`)
    const { createNotification } = require(`${__hooks}/services/notification.js`)
    const { sendNotificationEmail } = require(`${__hooks}/services/mail.js`)

    if (DRY_MODE) return

    const message = e.record
    const recipientId = message.get('to')
    const senderId = message.get('from')

    // Check email throttle BEFORE creating the notification:
    // skip email if a 'new_message' notification was created for this recipient
    // within the last MAIL_THROTTLE_MINUTES minutes.
    const cutoff = new Date(Date.now() - MAIL_THROTTLE_MINUTES * 60 * 1000)
    const cutoffStr = cutoff.toISOString().replace('T', ' ')

    let isThrottled = false
    try {
        $app.findFirstRecordByFilter(
            'notifications',
            'recipient = {:recipientId} && type = "new_message" && created > {:cutoff}',
            { recipientId: recipientId, cutoff: cutoffStr }
        )
        // If we get here, a recent notification exists — throttle the email
        isThrottled = true
    } catch (err) {
        // No recent notification found — not throttled
        isThrottled = false
    }

    // Create in-app notification (always, no throttle)
    createNotification($app, {
        recipient: recipientId,
        sender: senderId,
        type: 'new_message',
        relatedId: message.id,
        body: 'Du hast eine neue Nachricht erhalten.',
    })

    if (isThrottled) {
        $app.logger().debug(
            '[notification] Email throttled for recipient',
            'recipientId', recipientId
        )
        return
    }

    // Resolve recipient and sender user records
    try {
        const recipient = $app.findRecordById('users', recipientId)
        const sender = $app.findRecordById('users', senderId)
        const recipientEmail = recipient.email()
        const recipientName = recipient.get('name') || 'Nutzer/in'
        const senderName = sender.get('name') || 'Jemand'

        if (!recipientEmail) {
            $app.logger().warn(
                '[notification] Recipient has no email address',
                'recipientId', recipientId
            )
            return
        }

        // Render the email body from template
        const body = $template
            .loadFiles(`${__hooks}/views/mail/new_message.html`)
            .render({ RECIPIENT_NAME: recipientName, SENDER_NAME: senderName })

        sendNotificationEmail($app, {
            to: recipientEmail,
            subject: 'Neue Nachricht auf AllerLeih',
            body: body,
        })

        $app.logger().info(
            '[notification] Email sent for new message',
            'recipientId', recipientId,
            'messageId', message.id
        )
    } catch (err) {
        $app.logger().error(
            '[notification] Failed to send email notification',
            'error', err.toString(),
            'recipientId', recipientId
        )
    }
}, 'messages')
