/// <reference path="../pb_data/types.d.ts" />

/**
 * Central configuration — all environment variables and constants in one place.
 *
 * Usage in other hook files:
 *   const { LOG_LEVEL, VAPID_PRIVATE_KEY } = require(`${__hooks}/constants.js`)
 */

/** Log verbosity: 1=DEBUG, 2=INFO, 3=WARN, 4=ERROR */
const LOG_LEVEL = parseInt($os.getenv('LOG_LEVEL') || '4')

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
const MAIL_THROTTLE_MINUTES = parseInt($os.getenv('MAIL_THROTTLE_MINUTES') || '15')

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
const APP_URL = $os.getenv('APP_URL') || ''

module.exports = {
    LOG_LEVEL,
    VAPID_PUBLIC_KEY,
    VAPID_PRIVATE_KEY,
    VAPID_SUBJECT,
    ORS_API_KEY,
    DRY_MODE,
    MAIL_THROTTLE_MINUTES,
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
