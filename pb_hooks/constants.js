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
 * GDPR data-retention windows (#461) — enforced by the nightly jobs in
 * retention.pb.js. Defaults come from the privacy policy (DSE v2.8). Override per
 * deployment via env; a value of 0 disables the corresponding job (see retention.js).
 */
const RETENTION_INACTIVE_MONTHS = parseInt($os.getenv('RETENTION_INACTIVE_MONTHS') || '6')
const RETENTION_MESSAGES_MONTHS = parseInt($os.getenv('RETENTION_MESSAGES_MONTHS') || '6')
const RETENTION_NOTIFICATIONS_DAYS = parseInt($os.getenv('RETENTION_NOTIFICATIONS_DAYS') || '90')
const RETENTION_FEEDBACK_MONTHS = parseInt($os.getenv('RETENTION_FEEDBACK_MONTHS') || '6')

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

module.exports = {
    LOG_LEVEL,
    VAPID_PUBLIC_KEY,
    VAPID_PRIVATE_KEY,
    VAPID_SUBJECT,
    ORS_API_KEY,
    DRY_MODE,
    MAIL_THROTTLE_MINUTES,
    RETENTION_INACTIVE_MONTHS,
    RETENTION_MESSAGES_MONTHS,
    RETENTION_NOTIFICATIONS_DAYS,
    RETENTION_FEEDBACK_MONTHS,
    ADMIN_NOTIFY_EMAIL,
    RETENTION_SKIP_NOTICE_COOLDOWN_DAYS,
    RETENTION_PAGE_SIZE,
}
