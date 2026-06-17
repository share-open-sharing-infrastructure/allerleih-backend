/// <reference path="../../pb_data/types.d.ts" />

/**
 * Mail service — sends notification emails using PocketBase's built-in mailer.
 *
 * Uses the base layout template (views/layout.html) and injects content HTML.
 */

/**
 * Sends a notification email to the specified address.
 *
 * @param {object} app - The PocketBase app instance ($app)
 * @param {object} options
 * @param {string} options.to - Recipient email address
 * @param {string} options.subject - Email subject line
 * @param {string} options.body - HTML content to inject into the layout template
 */
function sendNotificationEmail(app, { to, subject, body }) {
    const html = $template
        .loadFiles(`${__hooks}/views/layout.html`)
        .render({ CONTENT: body })

    const message = new MailerMessage({
        from: {
            address: app.settings().meta.senderAddress,
            name: app.settings().meta.senderName,
        },
        to: [{ address: to }],
        subject: subject,
        html: html,
    })

    app.newMailClient().send(message)
}

module.exports = {
    sendNotificationEmail,
}
