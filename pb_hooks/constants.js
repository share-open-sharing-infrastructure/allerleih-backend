/// <reference path="../pb_data/types.d.ts" />

/**
 * Central configuration — all environment variables and constants in one place.
 *
 * Usage in other hook files:
 *   const { LOG_LEVEL, VAPID_PRIVATE_KEY } = require(`${__hooks}/constants.js`)
 */

/** Integer env var with fallback — parseInt alone yields NaN on non-numeric garbage. */
function intEnv(name, fallback) {
    const n = parseInt($os.getenv(name) || '')
    return Number.isNaN(n) ? fallback : n
}

/** Log verbosity: 1=DEBUG, 2=INFO, 3=WARN, 4=ERROR */
const LOG_LEVEL = intEnv('LOG_LEVEL', 4)

/** VAPID keys for Web Push notifications */
const VAPID_PUBLIC_KEY = $os.getenv('VAPID_PUBLIC_KEY') || ''
const VAPID_PRIVATE_KEY = $os.getenv('VAPID_PRIVATE_KEY') || ''
const VAPID_SUBJECT = $os.getenv('VAPID_SUBJECT') || 'mailto:allerleih@posteo.de'

/**
 * OpenRouteService API key — required by the /api/travel-times hook, which
 * computes travel durations server-side (coordinates never reach the client).
 * Must be set in the backend environment; without it ORS rejects every request
 * and travel times silently disappear.
 */
const ORS_API_KEY = $os.getenv('ORS_API_KEY') || ''

/** Feature flags */
const DRY_MODE = $os.getenv('DRY_MODE') === 'true'

/** Email notification throttle (minutes) — max 1 email per recipient within this window */
const MAIL_THROTTLE_MINUTES = intEnv('MAIL_THROTTLE_MINUTES', 15)

/**
 * SvelteKit frontend origin (no trailing slash), e.g. "https://allerleih.org".
 * Kept for the #447 auth-mail links (host of the `users` verification/reset URLs) and as the
 * `APP_URL` fallback — see auth_mail_templates.pb.js + mail_config.pb.js. It is NO LONGER used for
 * integration sync (#487 Phase 3 moved sync/refresh + the CSV write path fully into the backend).
 */
const FRONTEND_URL = ($os.getenv('FRONTEND_URL') || '').replace(/\/+$/, '')
/** Cron expression for the full catalogue pull; empty = job disabled.
 * Runs LOCALLY in the backend (integrations/sync.js) — no HTTP call, only a valid expression. */
const SYNC_CRON = $os.getenv('SYNC_CRON') || ''
/** Cron expression for the per-item refresh; empty = job disabled.
 * Runs LOCALLY in the backend (integrations/refresh.js) — no HTTP call, only a valid expression. */
const REFRESH_CRON = $os.getenv('REFRESH_CRON') || ''
/**
 * Allow http:// and private/loopback integration base URLs, bypassing the SSRF guard in
 * pb_hooks/integrations/urlGuard.js. Applies to BOTH the refresh (fetchItemById) and, as of #487
 * Phase 2, the full-sync bulk feed (fetchAllItems). Local dev / integration tests only (e.g.
 * loopback stub servers) — NEVER set in production. Backend replacement for the Vite `dev` flag.
 */
const INTEGRATION_ALLOW_INSECURE_URL = $os.getenv('INTEGRATION_ALLOW_INSECURE_URL') === 'true'

/**
 * GDPR data-retention windows (#461) — enforced by the nightly jobs in
 * retention.pb.js. Defaults come from the privacy policy (DSE v2.8). Override per
 * deployment via env; a value of 0 disables the corresponding job (see retention.js).
 */
const RETENTION_INACTIVE_MONTHS = parseInt($os.getenv('RETENTION_INACTIVE_MONTHS') || '6')
const RETENTION_MESSAGES_MONTHS = parseInt($os.getenv('RETENTION_MESSAGES_MONTHS') || '6')
const RETENTION_NOTIFICATIONS_DAYS = parseInt($os.getenv('RETENTION_NOTIFICATIONS_DAYS') || '90')
const RETENTION_FEEDBACK_MONTHS = parseInt($os.getenv('RETENTION_FEEDBACK_MONTHS') || '6')

/**
 * How many days before the inactive-account deletion threshold the advance-warning
 * email is sent (once per inactivity cycle; logging in re-arms it). 0 disables the
 * warning job. Runs independently of the deletion job — it never delays a deletion.
 */
const RETENTION_INACTIVE_WARN_DAYS = parseInt($os.getenv('RETENTION_INACTIVE_WARN_DAYS') || '30')

/**
 * Where to notify a platform admin when an inactive account is *skipped* because it
 * still has an open loan (the #461 edge case). Empty => admin mail is skipped (logged).
 */
const ADMIN_NOTIFY_EMAIL = $os.getenv('ADMIN_NOTIFY_EMAIL') || ''

/**
 * Cooldown (days) between repeat "deletion postponed (open loan)" skip notices for the
 * same account — the job runs nightly, so without this the user + admin would be mailed
 * every night until the loan closes.
 */
const RETENTION_SKIP_NOTICE_COOLDOWN_DAYS = parseInt($os.getenv('RETENTION_SKIP_NOTICE_COOLDOWN_DAYS') || '7')

/**
 * How many records a retention job processes per page. Keyset-paginated so a large
 * backlog is never loaded into memory at once. Tests set this low to exercise the
 * multi-page loop (cf. GROUP_FIXUP_PAGE).
 */
const RETENTION_PAGE_SIZE = parseInt($os.getenv('RETENTION_PAGE_SIZE') || '200')

/**
 * SMTP — applied on bootstrap by mail_config.pb.js only when SMTP_HOST is set (unset = no-op,
 * existing admin-UI settings untouched; see that file for the full behavior and #8 rationale).
 * SMTP_TLS=true = implicit TLS (port 465); false = STARTTLS (port 587). SENDER_ADDRESS /
 * SENDER_NAME / APP_URL override the meta settings when set.
 */
const SMTP_HOST = $os.getenv('SMTP_HOST') || ''
const SMTP_PORT = parseInt($os.getenv('SMTP_PORT') || '587')
const SMTP_USERNAME = $os.getenv('SMTP_USERNAME') || ''
const SMTP_PASSWORD = $os.getenv('SMTP_PASSWORD') || ''
const SMTP_TLS = $os.getenv('SMTP_TLS') === 'true'
const SMTP_AUTH_METHOD = $os.getenv('SMTP_AUTH_METHOD') || 'PLAIN'
const SMTP_LOCAL_NAME = $os.getenv('SMTP_LOCAL_NAME') || ''
const SENDER_ADDRESS = $os.getenv('SENDER_ADDRESS') || ''
const SENDER_NAME = $os.getenv('SENDER_NAME') || ''
/**
 * Application URL used as the documented fallback host for the `{APP_URL}` placeholder in the
 * `users` auth-mail templates (#447). Defaults to FRONTEND_URL so that — when no explicit APP_URL
 * is set — those user-facing links still point at the SvelteKit frontend rather than the backend.
 * NOTE: `mail_config.pb.js` only writes `settings.meta.appURL` from an EXPLICITLY-set APP_URL env
 * var, never from this FRONTEND_URL fallback — otherwise the `_superusers` admin links (which rely
 * on appURL pointing at the backend admin UI) would break (see #447 decision).
 */
const APP_URL = $os.getenv('APP_URL') || FRONTEND_URL

module.exports = {
    LOG_LEVEL,
    VAPID_PUBLIC_KEY,
    VAPID_PRIVATE_KEY,
    VAPID_SUBJECT,
    ORS_API_KEY,
    DRY_MODE,
    MAIL_THROTTLE_MINUTES,
    FRONTEND_URL,
    SYNC_CRON,
    REFRESH_CRON,
    INTEGRATION_ALLOW_INSECURE_URL,
    RETENTION_INACTIVE_MONTHS,
    RETENTION_MESSAGES_MONTHS,
    RETENTION_NOTIFICATIONS_DAYS,
    RETENTION_FEEDBACK_MONTHS,
    RETENTION_INACTIVE_WARN_DAYS,
    ADMIN_NOTIFY_EMAIL,
    RETENTION_SKIP_NOTICE_COOLDOWN_DAYS,
    RETENTION_PAGE_SIZE,
    SMTP_HOST,
    SMTP_PORT,
    SMTP_USERNAME,
    SMTP_PASSWORD,
    SMTP_TLS,
    SMTP_AUTH_METHOD,
    SMTP_LOCAL_NAME,
    SENDER_ADDRESS,
    SENDER_NAME,
    APP_URL,
}
