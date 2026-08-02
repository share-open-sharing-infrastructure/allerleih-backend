/// <reference path="../../pb_data/types.d.ts" />

/**
 * Mail service — sends notification emails using PocketBase's built-in mailer.
 *
 * Uses the base layout template (views/layout.html) and injects content HTML.
 *
 * #607 mail deliverability rewrite adds, on top of the original HTML-only send:
 *   - a plaintext `text` alternative (multipart/alternative) — either an explicit override or
 *     htmlToText(body) plus a plaintext footer mirroring the HTML layout's footer;
 *   - anti-auto-reply headers on every mail (`Auto-Submitted`, `X-Auto-Response-Suppress`);
 *   - `List-Unsubscribe` / `List-Unsubscribe-Post` (RFC 8058 one-click) when the caller passes an
 *     `unsubscribeUrl`, and `Precedence: bulk` for `kind: 'bulk'` sends;
 *   - a bulk-mail sender identity (`DIGEST_SENDER_ADDRESS`/`DIGEST_SENDER_NAME`) that only takes
 *     effect once explicitly configured — empty (default) behaves exactly like before;
 *   - an optional reusable `client` (see jobs/digest.js — one client for the whole run instead of
 *     one `app.newMailClient()` per recipient).
 *
 * `buildMessage` is exported separately from `sendNotificationEmail` so tests can inspect the
 * constructed MailerMessage without actually sending it.
 */

const { assetBase, siteBase } = require(`${__hooks}/utils/urls.js`)
const { htmlToText } = require(`${__hooks}/utils/htmlToText.js`)
const { SENDER_ADDRESS, SENDER_NAME, DIGEST_SENDER_ADDRESS, DIGEST_SENDER_NAME } = require(`${__hooks}/constants.js`)

const KIND_TRANSACTIONAL = 'transactional'
const KIND_BULK = 'bulk'

/**
 * Resolve the From identity for a send. `kind: 'bulk'` only switches to the digest identity when
 * DIGEST_SENDER_ADDRESS is explicitly set — DIGEST_SENDER_NAME alone must NOT change the address
 * (name and domain would end up mismatched). Empty config ⇒ identical to the pre-#607 behavior.
 */
function senderFor(app, kind) {
    if (kind === KIND_BULK && DIGEST_SENDER_ADDRESS) {
        return { address: DIGEST_SENDER_ADDRESS, name: DIGEST_SENDER_NAME || app.settings().meta.senderName }
    }
    return { address: app.settings().meta.senderAddress, name: app.settings().meta.senderName }
}

/** Plaintext mirror of the HTML layout's footer (brand line + unsubscribe/prefs links). */
function textFooter({ site, prefsUrl, unsubscribeUrl }) {
    const lines = ['', '--', 'AllerLeih' + (site ? ` (${site}/)` : '') + ' — Teilen statt Besitzen']
    if (unsubscribeUrl) lines.push(`Wochen-Rückblick abbestellen: ${unsubscribeUrl}`)
    if (prefsUrl) lines.push(`Benachrichtigungen anpassen: ${prefsUrl}`)
    return lines.join('\n')
}

/**
 * Build (but do not send) the MailerMessage for a notification email.
 *
 * @param {object} app - The PocketBase app instance ($app)
 * @param {object} opts
 * @param {string} opts.to - Recipient email address
 * @param {string} opts.subject - Email subject line
 * @param {string} opts.body - HTML content injected into the layout template
 * @param {string} [opts.text] - Plaintext override; default = htmlToText(body) + a plaintext footer
 * @param {'transactional'|'bulk'} [opts.kind] - Default 'transactional'
 * @param {string} [opts.unsubscribeUrl] - HTTPS URL; when set, adds List-Unsubscribe (One-Click)
 */
function buildMessage(app, { to, subject, body, text, kind, unsubscribeUrl }) {
    const effectiveKind = kind || KIND_TRANSACTIONAL

    const asset = assetBase(app)
    const site = siteBase(app)
    const prefsUrl = site ? site + '/user/profile#benachrichtigungen' : ''

    const html = $template.loadFiles(`${__hooks}/views/layout.html`).render({
        CONTENT: body,
        ASSET_URL: asset,
        SITE_URL: site,
        UNSUBSCRIBE_URL: unsubscribeUrl || '',
        PREFS_URL: prefsUrl,
    })

    const plain = text || htmlToText(body) + textFooter({ site, prefsUrl, unsubscribeUrl })

    const headers = {
        'Auto-Submitted': 'auto-generated',
        'X-Auto-Response-Suppress': 'OOF, AutoReply',
    }
    if (unsubscribeUrl) {
        headers['List-Unsubscribe'] = '<' + unsubscribeUrl + '>'
        headers['List-Unsubscribe-Post'] = 'List-Unsubscribe=One-Click'
    }
    if (effectiveKind === KIND_BULK) headers['Precedence'] = 'bulk'

    return new MailerMessage({
        from: senderFor(app, effectiveKind),
        to: [{ address: to }],
        subject: subject,
        html: html,
        text: plain,
        headers: headers,
    })
}

/**
 * Sends a notification email to the specified address.
 *
 * @param {object} app - The PocketBase app instance ($app)
 * @param {object} opts - See buildMessage() for the shared fields, plus:
 * @param {object} [opts.client] - A mail client to reuse (see jobs/digest.js); defaults to a
 *   fresh app.newMailClient() per call.
 */
function sendNotificationEmail(app, opts) {
    const message = buildMessage(app, opts)
    ;(opts.client || app.newMailClient()).send(message)
}

module.exports = {
    KIND_TRANSACTIONAL,
    KIND_BULK,
    buildMessage,
    sendNotificationEmail,
}
