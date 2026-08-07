/// <reference path="../pb_data/types.d.ts" />

// Business-metrics project: gate the frontend's /admin/metrics dashboard via a DB flag
// instead of an ADMIN_EMAILS env allowlist (an env var is per-deployment and easy to
// forget/desync across environments; a DB flag is visible/auditable in the PocketBase
// admin UI and travels with the data, same as the existing isInstitution toggle).
//
// `hidden: true`: the base `users` collection's viewRule (`@request.auth.id != ""`)
// lets ANY authenticated user view ANY other user's full row — unlike isInstitution
// (deliberately public, shown on profiles), platform-admin status must never leak to
// other users. hidden fields are excluded from every non-superuser API response, so
// only the server's superuser client can read it (see $lib/server/metrics.ts).
//
// The updateRule clause is defense-in-depth on top of that, matching the existing
// isInstitution/legalLocked/tosAcceptedVersion/privacyAcceptedVersion pattern: every
// other admin/system-only toggle on this collection is explicitly excluded from the
// user's own update body, so this one is too — set only via the PocketBase admin UI.
const NEW_RULE =
    '@request.auth.id = id && @request.body.isInstitution:isset = false && @request.body.legalLocked:isset = false && @request.body.tosAcceptedVersion:isset = false && @request.body.privacyAcceptedVersion:isset = false && @request.body.isAdmin:isset = false'
const OLD_RULE =
    '@request.auth.id = id && @request.body.isInstitution:isset = false && @request.body.legalLocked:isset = false && @request.body.tosAcceptedVersion:isset = false && @request.body.privacyAcceptedVersion:isset = false'

migrate(
    (app) => {
        const c = app.findCollectionByNameOrId('users')
        c.fields.add(new Field({ type: 'bool', id: 'bool_user_is_admin', name: 'isAdmin', hidden: true, required: false }))
        c.updateRule = NEW_RULE
        return app.save(c)
    },
    (app) => {
        const c = app.findCollectionByNameOrId('users')
        c.fields.removeById('bool_user_is_admin')
        c.updateRule = OLD_RULE
        return app.save(c)
    }
)
