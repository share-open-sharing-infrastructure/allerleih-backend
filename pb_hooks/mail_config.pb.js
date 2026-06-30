/// <reference path="../pb_data/types.d.ts" />

/**
 * Mail configuration hook — applies the SMTP settings from the environment on bootstrap.
 *
 * PocketBase normally stores SMTP settings in the admin UI (pb_data, per-instance). Without a
 * working SMTP server it falls back to local sendmail, which is unreliable on servers and behind
 * restricted relays only delivers to verified addresses — the symptom reported in #8.
 *
 * Setting SMTP via env keeps it reproducible across instances and keeps the password out of the
 * repo. The hook only ever ADDS or UPDATES SMTP from the environment — it never removes anything:
 *   - SMTP_HOST set   → enable SMTP with the env values (idempotent: only writes on change).
 *   - SMTP_HOST unset → no-op; whatever is already configured (e.g. via the admin UI) is left
 *     completely untouched. This keeps deploys safe — an instance that sets SMTP in the admin UI
 *     is never disturbed by this hook. To remove an env-configured server: unset the vars and, if
 *     desired, disable SMTP in the admin UI.
 */
onBootstrap((e) => {
    e.next()

    const {
        SMTP_HOST, SMTP_PORT, SMTP_USERNAME, SMTP_PASSWORD, SMTP_TLS,
        SMTP_AUTH_METHOD, SMTP_LOCAL_NAME, SENDER_ADDRESS, SENDER_NAME, APP_URL,
    } = require(`${__hooks}/constants.js`)

    // No SMTP_HOST → leave whatever is already configured (e.g. via the admin UI) completely
    // untouched. The hook only ever adds/updates SMTP from the env; it never disables or clears,
    // so deploying it can never wipe an admin-UI-configured SMTP server.
    if (!SMTP_HOST) {
        $app.logger().info('[mail] SMTP_HOST not set — leaving existing mail settings untouched')
        return
    }

    try {
        const settings = $app.settings()
        const s = settings.smtp

        // Idempotent: only persist when something actually differs from what's already stored, so a
        // restart with unchanged env doesn't re-write (and re-encrypt) the settings on every boot.
        const changed =
            s.enabled !== true ||
            s.host !== SMTP_HOST ||
            s.port !== SMTP_PORT ||
            s.username !== SMTP_USERNAME ||
            s.password !== SMTP_PASSWORD ||
            s.tls !== SMTP_TLS ||
            s.authMethod !== SMTP_AUTH_METHOD ||
            s.localName !== SMTP_LOCAL_NAME ||
            (SENDER_ADDRESS && settings.meta.senderAddress !== SENDER_ADDRESS) ||
            (SENDER_NAME && settings.meta.senderName !== SENDER_NAME) ||
            (APP_URL && settings.meta.appURL !== APP_URL)

        if (!changed) {
            $app.logger().info('[mail] SMTP already matches environment — no change', 'host', SMTP_HOST)
            return
        }

        s.enabled = true
        s.host = SMTP_HOST
        s.port = SMTP_PORT
        s.username = SMTP_USERNAME
        s.password = SMTP_PASSWORD
        s.tls = SMTP_TLS
        s.authMethod = SMTP_AUTH_METHOD
        s.localName = SMTP_LOCAL_NAME

        // Sender identity / app URL are optional overrides — only touch them when provided so the
        // admin-UI values remain authoritative otherwise.
        if (SENDER_ADDRESS) settings.meta.senderAddress = SENDER_ADDRESS
        if (SENDER_NAME) settings.meta.senderName = SENDER_NAME
        if (APP_URL) settings.meta.appURL = APP_URL

        $app.save(settings)

        $app.logger().info(
            '[mail] SMTP configured from environment',
            'host', SMTP_HOST,
            'port', SMTP_PORT,
            'tls', SMTP_TLS,
            'sender', settings.meta.senderAddress
        )
    } catch (err) {
        // A rejected save (e.g. invalid port/host) must not be easy to miss: the instance would
        // otherwise keep running with whatever SMTP state was already in pb_data and mail would
        // silently not work as intended. We do NOT abort bootstrap (a mail typo shouldn't take the
        // whole API down), but we log it unmistakably.
        $app.logger().error(
            '[mail] FAILED to apply SMTP settings from environment — MAIL IS NOT CONFIGURED as intended, delivery may not work',
            'host', SMTP_HOST,
            'error', err.toString()
        )
    }
})
