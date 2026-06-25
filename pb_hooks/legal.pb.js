/// <reference path="../pb_data/types.d.ts" />

// Platform legal consent — SERVER-AUTHORITATIVE (Issue #399).
//
// Every consent state change runs here in superuser context, because the pieces
// the consent gate depends on are deliberately outside the user's write surface:
//   - users.tosAcceptedVersion / privacyAcceptedVersion (the gate's cache) and
//     users.legalLocked are blocked in the users updateRule, and
//   - user_legal_acceptances has createRule = null (no direct client writes).
// This makes the gate non-bypassable (review #1) and the audit trail unforgeable
// (review #2): the version + body snapshot are read from the ACTIVE
// legal_documents row, never from the request body, and acceptedAt/IP/UA are
// stamped server-side. Accept/decline run in a single transaction (review #3/#5)
// and the decline-lock is cleared as part of re-accepting (review #9).

// POST /api/legal/accept — record the authenticated user's acceptance of the
// currently-active documents, refresh their version cache, and clear any lock.
routerAdd(
    'POST',
    '/api/legal/accept',
    (e) => {
        const uid = e.auth ? e.auth.id : ''
        if (!uid) return e.json(401, { message: 'Authentication required' })

        const ip = e.realIP() || ''
        const ua = e.request.header.get('User-Agent') || ''

        try {
            $app.runInTransaction((txApp) => {
                const user = txApp.findRecordById('users', uid)
                const acc = txApp.findCollectionByNameOrId('user_legal_acceptances')
                const active = txApp.findRecordsByFilter('legal_documents', 'active = true')
                const wasLocked = user.getBool('legalLocked')
                const nowIso = new Date().toISOString()

                for (const doc of active) {
                    const docType = doc.getString('docType')
                    const version = doc.getString('version')
                    const field = docType === 'tos' ? 'tosAcceptedVersion' : 'privacyAcceptedVersion'

                    // Record only what is genuinely being (re-)accepted: documents the
                    // user has not yet accepted at the current version, OR everything if
                    // the account is locked (a locked user re-affirms to self-recover,
                    // even if their cached version happens to already match — review #9).
                    const outstanding = user.getString(field) !== version
                    if (!outstanding && !wasLocked) continue

                    const rec = new Record(acc)
                    rec.set('user', uid)
                    rec.set('docType', docType)
                    rec.set('version', version)
                    rec.set('decision', 'accepted')
                    rec.set('acceptedAt', nowIso)
                    rec.set('bodySnapshot', doc.getString('body'))
                    rec.set('userIp', ip)
                    rec.set('userAgent', ua)
                    txApp.save(rec)

                    user.set(field, version)
                }

                user.set('legalLocked', false)
                txApp.save(user)
            })
        } catch (err) {
            $app.logger().error('legal accept failed', 'user', uid, 'error', String(err))
            return e.json(500, { message: 'Could not record acceptance' })
        }

        return e.json(200, { accepted: true })
    },
    $apis.requireAuth()
)

// POST /api/legal/decline — record the user's rejection of the active documents
// and lock the account. The version cache is intentionally left untouched, so the
// gate keeps redirecting them to /legal/accept until they (re-)accept.
routerAdd(
    'POST',
    '/api/legal/decline',
    (e) => {
        const uid = e.auth ? e.auth.id : ''
        if (!uid) return e.json(401, { message: 'Authentication required' })

        const ip = e.realIP() || ''
        const ua = e.request.header.get('User-Agent') || ''

        try {
            $app.runInTransaction((txApp) => {
                const user = txApp.findRecordById('users', uid)
                const acc = txApp.findCollectionByNameOrId('user_legal_acceptances')
                const active = txApp.findRecordsByFilter('legal_documents', 'active = true')
                const nowIso = new Date().toISOString()

                for (const doc of active) {
                    const rec = new Record(acc)
                    rec.set('user', uid)
                    rec.set('docType', doc.getString('docType'))
                    rec.set('version', doc.getString('version'))
                    rec.set('decision', 'declined')
                    rec.set('acceptedAt', nowIso)
                    rec.set('bodySnapshot', doc.getString('body'))
                    rec.set('userIp', ip)
                    rec.set('userAgent', ua)
                    txApp.save(rec)
                }

                user.set('legalLocked', true)
                txApp.save(user)
            })
        } catch (err) {
            $app.logger().error('legal decline failed', 'user', uid, 'error', String(err))
            return e.json(500, { message: 'Could not record decision' })
        }

        return e.json(200, { locked: true })
    },
    $apis.requireAuth()
)

// Registration = consent: the register form requires the legal checkbox, and
// users can only be created through it, so stamp the active versions onto the new
// record before it is saved (server-set — the field is not client-writable).
onRecordCreate((e) => {
    try {
        // legalLocked is server-only — pin it false on create so a registration POST
        // can't pre-set it (the updateRule blocks it, but createRule doesn't — #2).
        e.record.set('legalLocked', false)
        const active = $app.findRecordsByFilter('legal_documents', 'active = true')
        for (const doc of active) {
            const field = doc.getString('docType') === 'tos' ? 'tosAcceptedVersion' : 'privacyAcceptedVersion'
            e.record.set(field, doc.getString('version'))
        }
    } catch (err) {
        $app.logger().error('legal version stamp on user create failed', 'error', String(err))
    }
    e.next()
}, 'users')

// ...and write the matching immutable acceptance audit records once the user row
// exists (needs the saved id). Best-effort: a failure here must not abort sign-up.
onRecordAfterCreateSuccess((e) => {
    const uid = e.record.id
    try {
        const acc = $app.findCollectionByNameOrId('user_legal_acceptances')
        const active = $app.findRecordsByFilter('legal_documents', 'active = true')
        const ip = e.realIP ? (e.realIP() || '') : ''
        const ua = e.request ? (e.request.header.get('User-Agent') || '') : ''
        const nowIso = new Date().toISOString()
        for (const doc of active) {
            const rec = new Record(acc)
            rec.set('user', uid)
            rec.set('docType', doc.getString('docType'))
            rec.set('version', doc.getString('version'))
            rec.set('decision', 'accepted')
            rec.set('acceptedAt', nowIso)
            rec.set('bodySnapshot', doc.getString('body'))
            rec.set('userIp', ip)
            rec.set('userAgent', ua)
            $app.save(rec)
        }
    } catch (err) {
        $app.logger().error('initial legal acceptance record failed', 'user', uid, 'error', String(err))
    }
    e.next()
}, 'users')

// Enforce the decline-lock at the DATA layer, not just in the SvelteKit gate
// (review #4): a locked account has a valid token and could otherwise mutate data
// directly via the PB API. Block all create/update/delete requests from a locked
// user. Reads still work (browsing), and self-recovery is unaffected because the
// accept route writes in superuser context (these hooks fire only for API CRUD
// requests, not internal $app.save). Registration is unaffected (no auth yet).
function blockIfLegalLocked(e) {
    const { isAuthLegalLocked } = require(`${__hooks}/services/legal.js`)
    if (isAuthLegalLocked(e.auth)) {
        throw new ForbiddenError('Account is locked pending legal consent. Please accept the current terms to continue.')
    }
    e.next()
}
onRecordCreateRequest(blockIfLegalLocked)
onRecordUpdateRequest(blockIfLegalLocked)
onRecordDeleteRequest(blockIfLegalLocked)
