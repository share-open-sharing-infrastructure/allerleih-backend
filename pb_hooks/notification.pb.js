/// <reference path="../pb_data/types.d.ts" />

/**
 * Notification hooks — handle side-effects when notifications-relevant events occur.
 *
 * When a new message is created:
 * - Sends an email notification (throttled: max 1 per recipient per MAIL_THROTTLE_MINUTES)
 * - Respects user_preferences.emailNotifications opt-out (default: opted-in)
 *
 * Note: The in-app notification is created by the frontend sendMessage action
 * (with the correct conversation relatedId and push notification).
 */

onRecordAfterCreateSuccess((e) => {
    const { DRY_MODE, MAIL_THROTTLE_MINUTES } = require(`${__hooks}/constants.js`)
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

    if (isThrottled) {
        $app.logger().debug(
            '[notification] Email throttled for recipient',
            'recipientId', recipientId
        )
        return
    }

    // Check if recipient is currently viewing the conversation.
    // The frontend periodically updates requesterLastSeenAt / ownerLastSeenAt while
    // the conversation page is open. If the timestamp is within the last 30 seconds,
    // the recipient is actively viewing — skip the email.
    try {
        const conversation = $app.findFirstRecordByFilter(
            'conversations',
            '(requester = {:recipientId} || itemOwner = {:recipientId}) && (requester = {:senderId} || itemOwner = {:senderId})',
            { recipientId: recipientId, senderId: senderId }
        )
        if (conversation) {
            const recipientIsRequester = conversation.get('requester') === recipientId
            const lastSeenStr = recipientIsRequester
                ? conversation.get('requesterLastSeenAt')
                : conversation.get('ownerLastSeenAt')
            if (lastSeenStr) {
                const lastSeen = new Date(lastSeenStr).getTime()
                const now = Date.now()
                if (now - lastSeen < 30000) {
                    $app.logger().debug(
                        '[notification] Recipient is viewing conversation, skipping email',
                        'recipientId', recipientId,
                        'lastSeenAt', lastSeenStr
                    )
                    return
                }
            }
        }
    } catch (err) {
        // Conversation not found — proceed with email (e.g. edge case)
    }

    // Check if recipient has opted out of email notifications.
    // Default: opted-in (no preferences record = emails enabled).
    try {
        const prefs = $app.findFirstRecordByFilter(
            'user_preferences',
            'user = {:recipientId}',
            { recipientId: recipientId }
        )
        if (prefs && prefs.get('emailNotifications') === false) {
            $app.logger().debug(
                '[notification] Recipient opted out of email notifications',
                'recipientId', recipientId
            )
            return
        }
    } catch (err) {
        // No preferences record found — default to opted-in
    }

    // Resolve recipient and sender user records
    try {
        const recipient = $app.findRecordById('users', recipientId)
        const sender = $app.findRecordById('users', senderId)
        const recipientEmail = recipient.email()
        const recipientName = recipient.get('username') || 'Nutzer:in'
        const senderName = sender.get('username') || 'Jemand'

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
