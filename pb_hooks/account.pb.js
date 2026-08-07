/// <reference path="../pb_data/types.d.ts" />

// Self-service GDPR endpoints for the authenticated user:
//   DELETE /api/account         — erase/anonymize the own account (Art. 17)
//   GET    /api/account/export  — machine-readable copy of the own data (Art. 15/20)
// Both run with superuser `$app` access because anonymization must delete records
// owned by other users (e.g. `trusts` edges) and the export reads across
// collections. Login for an already deleted account is blocked via
// onRecordAuthRequest below.

routerAdd(
    'DELETE',
    '/api/account',
    (e) => {
        const { findBlockingLoans, anonymizeAccount } = require(`${__hooks}/services/account.js`)

        const userId = e.auth.id

        // Re-authentication: require the current password before destroying the account.
        const info = e.requestInfo()
        const password = info.body && info.body.password ? String(info.body.password) : ''
        if (!password || !e.auth.validatePassword(password)) {
            return e.json(400, { code: 'invalid_password', message: 'Falsches Passwort.' })
        }

        // Refuse while a loan is still in flight — would strand the counterparty.
        const blocking = findBlockingLoans($app, userId)
        if (blocking.length > 0) {
            return e.json(409, {
                code: 'active_loans',
                message: 'Es gibt noch offene Ausleihen.',
                loans: blocking.map((c) => ({
                    id: c.id,
                    lendingStatus: c.get('lendingStatus'),
                    requestedItem: c.get('requestedItem'),
                })),
            })
        }

        try {
            $app.runInTransaction((txApp) => {
                const user = txApp.findRecordById('users', userId)
                anonymizeAccount(txApp, user)
            })
        } catch (err) {
            $app.logger().error('[account] deletion failed', 'userId', userId, 'error', err.toString())
            return e.json(500, { code: 'deletion_failed', message: 'Löschung fehlgeschlagen.' })
        }

        $app.logger().info('[account] account deleted (anonymized)', 'userId', userId)
        return e.json(200, { ok: true })
    },
    $apis.requireAuth()
)

routerAdd(
    'GET',
    '/api/account/export',
    (e) => {
        const { buildExport } = require(`${__hooks}/services/account.js`)
        const user = $app.findRecordById('users', e.auth.id)
        return e.json(200, buildExport($app, user))
    },
    $apis.requireAuth()
)

// Normalize the email (trim + lowercase) on every users create/update — Issue #557 /
// allerleih-backend#41. PocketBase matches emails case-sensitively and doesn't normalize
// on save, so a mixed-case address (`Julika7@…`) becomes an account that login/reset can
// never reach (they send the lower-case form the user types). The SvelteKit frontend
// normalizes at its own boundaries; these hooks are defense-in-depth for every OTHER path
// — admin UI, direct API writes, other hooks, the requestEmailChange confirm. Using the
// non-Request variants (onRecordCreate/onRecordUpdate) also covers internal elevated
// `$app.save()` writes. Idempotent: an already-normalized email is left as-is.
function normalizeUserEmail(e) {
    const { normalizeEmail } = require(`${__hooks}/utils/email.js`)
    const current = e.record.get('email')
    const normalized = normalizeEmail(current)
    if (normalized && normalized !== current) {
        e.record.set('email', normalized)
    }
    e.next()
}
onRecordCreate(normalizeUserEmail, 'users')
onRecordUpdate(normalizeUserEmail, 'users')

// Block authentication for accounts that have been deleted (anonymized), and stamp
// lastLoginAt for the inactive-account retention job (#461).
onRecordAuthRequest((e) => {
    if (e.record && e.record.getBool('deleted')) {
        throw new BadRequestError('Dieses Konto wurde gelöscht.')
    }

    // Record activity for the "delete inactive accounts" job. Throttle to once per
    // 24h: auth-refresh fires on every frontend request, so an unthrottled stamp
    // would write the user row on every call. Use a raw UPDATE (not record save) so
    // the stamp doesn't bump `users.updated` or emit a realtime event on every active
    // user. A stamping failure must never block login, so it is best-effort.
    if (e.record) {
        try {
            const { now, daysAgoIso } = require(`${__hooks}/utils/common.js`)
            const last = e.record.getString('lastLoginAt')
            if (!last || last < daysAgoIso(1)) {
                e.app
                    .db()
                    .newQuery('UPDATE users SET lastLoginAt = {:v} WHERE id = {:id}')
                    .bind({ v: now(), id: e.record.id })
                    .execute()
            }
        } catch (err) {
            e.app.logger().warn('[account] lastLoginAt stamp failed', 'error', String(err))
        }
    }

    e.next()
}, 'users')
