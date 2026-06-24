/// <reference path="../pb_data/types.d.ts" />

// Self-service GDPR endpoints for the authenticated user:
//   DELETE /api/account         — erase/anonymize the own account (Art. 17)
//   GET    /api/account/export  — machine-readable copy of the own data (Art. 15/20)
// Both run with superuser `$app` access because anonymization must edit other users'
// records (trusts[]) and the export reads across collections. Login for an already
// deleted account is blocked via onRecordAuthRequest below.

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

// Block authentication for accounts that have been deleted (anonymized).
onRecordAuthRequest((e) => {
    if (e.record && e.record.getBool('deleted')) {
        throw new BadRequestError('Dieses Konto wurde gelöscht.')
    }
    e.next()
}, 'users')
