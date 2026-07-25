/// <reference path="../pb_data/types.d.ts" />

/**
 * CSV-import write path (#487 Phase 3) — the institution-facing replacement for the frontend's
 * superuser/`SYNC_SECRET` apply + refresh. All routes require a normal authenticated user that is
 * an institution; the owner is always `e.auth.id` (never trusted from the payload). Shared logic
 * lives in integrations/import.js (reuses the diff/write/refresh port — no duplicate core).
 *
 * - POST /api/import/apply    → write the mapped rows (create/update/archive) → SyncSummary
 * - POST /api/import/preview  → dryRun: same diff, no write → { summary, rowActions, archiveRows }
 * - POST /api/import/refresh  → refresh only the caller's own items → SyncSummary
 *
 * The two WRITING routes take the integration-wide overlap lock (`integrations/lock.js`, shared with
 * the sync/refresh crons) and answer 409 when another run holds it; preview needs no lock.
 *
 * Body/auth pattern per travel.pb.js + account.pb.js (`e.requestInfo().body`, `e.auth`). Each
 * handler runs in an ISOLATED context, so the institution guard is inlined (top-level helpers are
 * not visible inside routerAdd callbacks).
 */

routerAdd(
    'POST',
    '/api/import/apply',
    (e) => {
        if (!e.auth || !e.auth.getBool('isInstitution')) {
            return e.json(403, { message: 'Only institutional accounts may import.' })
        }
        const { prepareRows, applyImport, withRunLock, BUSY_MESSAGE } = require(`${__hooks}/integrations/import.js`)
        const body = e.requestInfo().body || {}
        const prep = prepareRows(body.rows, e.auth.id) // Q3: hard 400 on a row without externalId
        if (!prep.ok) return e.json(400, { message: prep.message })

        // Serialised against the sync/refresh crons and any other import (see integrations/lock.js).
        const summary = withRunLock($app, () =>
            applyImport($app, e.auth.id, e.auth.getString('username'), prep.rows)
        )
        if (!summary) return e.json(409, { message: BUSY_MESSAGE })

        return e.json(200, summary)
    },
    $apis.requireAuth()
)

routerAdd(
    'POST',
    '/api/import/preview',
    (e) => {
        if (!e.auth || !e.auth.getBool('isInstitution')) {
            return e.json(403, { message: 'Only institutional accounts may import.' })
        }
        const { prepareRows, previewImport } = require(`${__hooks}/integrations/import.js`)
        const { errorMessage } = require(`${__hooks}/integrations/types.js`)
        const body = e.requestInfo().body || {}
        const prep = prepareRows(body.rows, e.auth.id)
        if (!prep.ok) return e.json(400, { message: prep.message })

        try {
            return e.json(200, previewImport($app, e.auth.id, prep.rows))
        } catch (err) {
            // A failed existing-items read must not masquerade as an empty preview.
            return e.json(503, { message: 'Could not load existing items: ' + errorMessage(err) })
        }
    },
    $apis.requireAuth()
)

routerAdd(
    'POST',
    '/api/import/refresh',
    (e) => {
        if (!e.auth || !e.auth.getBool('isInstitution')) {
            return e.json(403, { message: 'Only institutional accounts may import.' })
        }
        const { refreshOwn, withRunLock, BUSY_MESSAGE } = require(`${__hooks}/integrations/import.js`)

        // Serialised like apply: this walks every stored item and hits the upstream source once per
        // item (500 ms pause for WINBIAP), so parallel runs would hammer a partner's WebOPAC.
        const summary = withRunLock($app, () =>
            refreshOwn($app, e.auth.id, e.auth.getString('username'))
        )
        if (!summary) return e.json(409, { message: BUSY_MESSAGE })

        return e.json(200, summary)
    },
    $apis.requireAuth()
)
