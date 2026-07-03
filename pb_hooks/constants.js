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
 * Integration sync cron jobs — the backend periodically POSTs to the SvelteKit
 * frontend's bearer-protected /api/sync and /api/refresh endpoints, which pull
 * institutional catalogues from their external lending software.
 */
/** SvelteKit frontend origin (no trailing slash), e.g. "https://allerleih.org" */
const FRONTEND_URL = ($os.getenv('FRONTEND_URL') || '').replace(/\/+$/, '')
/** Bearer token for /api/sync + /api/refresh — must equal the frontend's SYNC_SECRET */
const SYNC_SECRET = $os.getenv('SYNC_SECRET') || ''
/** Cron expression for the full catalogue pull (POST /api/sync); empty = job disabled */
const SYNC_CRON = $os.getenv('SYNC_CRON') || ''
/** Cron expression for the per-item refresh (POST /api/refresh); empty = job disabled */
const REFRESH_CRON = $os.getenv('REFRESH_CRON') || ''
/** HTTP timeout for the sync/refresh calls — a full sync can take minutes (the frontend
 * batches creates 15-at-a-time with 5.5s pauses to stay under PocketBase rate limits) */
const SYNC_TIMEOUT_SECONDS = parseInt($os.getenv('SYNC_TIMEOUT_SECONDS') || '540')

module.exports = {
    LOG_LEVEL,
    VAPID_PUBLIC_KEY,
    VAPID_PRIVATE_KEY,
    VAPID_SUBJECT,
    ORS_API_KEY,
    DRY_MODE,
    MAIL_THROTTLE_MINUTES,
    FRONTEND_URL,
    SYNC_SECRET,
    SYNC_CRON,
    REFRESH_CRON,
    SYNC_TIMEOUT_SECONDS,
}
