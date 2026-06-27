/// <reference path="../pb_data/types.d.ts" />

// Platform legal-consent state on the user record.
//   tosAcceptedVersion / privacyAcceptedVersion — a cache of the latest version
//     the user has accepted, so the hot-path consent gate (hooks.server.ts) can
//     decide purely from the already-loaded auth record without a DB query.
//     SERVER-ONLY: excluded from the user updateRule below and set only by the
//     legal.pb.js hooks (superuser). If the user could patch these directly the
//     whole consent gate would be one API call away from bypass (review #1).
//   legalLocked — set true (only by the legal.pb.js hook, superuser context) when
//     a user declines the current terms; cleared when they re-accept. Also outside
//     the user updateRule so the account holder cannot self-clear the lock.
migrate((app) => {
  const collection = app.findCollectionByNameOrId("hbacudkt08pfcy3")

  collection.fields.add(new Field({
    "autogeneratePattern": "",
    "help": "",
    "hidden": false,
    "id": "text_user_tosver",
    "max": 50,
    "min": 0,
    "name": "tosAcceptedVersion",
    "pattern": "",
    "presentable": false,
    "primaryKey": false,
    "required": false,
    "system": false,
    "type": "text"
  }))

  collection.fields.add(new Field({
    "autogeneratePattern": "",
    "help": "",
    "hidden": false,
    "id": "text_user_privver",
    "max": 50,
    "min": 0,
    "name": "privacyAcceptedVersion",
    "pattern": "",
    "presentable": false,
    "primaryKey": false,
    "required": false,
    "system": false,
    "type": "text"
  }))

  collection.fields.add(new Field({
    "help": "",
    "hidden": false,
    "id": "bool_user_legallocked",
    "name": "legalLocked",
    "presentable": false,
    "required": false,
    "system": false,
    "type": "bool"
  }))

  // Keep the consent-state fields out of the user's own write surface (alongside
  // the existing isInstitution guard) so they can only be set by the hooks/admin.
  // legalLocked must not be self-clearable; the version cache must not be settable
  // (else the consent gate is trivially bypassed — review #1).
  collection.updateRule = "@request.auth.id = id && @request.body.isInstitution:isset = false && @request.body.legalLocked:isset = false && @request.body.tosAcceptedVersion:isset = false && @request.body.privacyAcceptedVersion:isset = false"

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("hbacudkt08pfcy3")

  collection.fields.removeById("text_user_tosver")
  collection.fields.removeById("text_user_privver")
  collection.fields.removeById("bool_user_legallocked")
  collection.updateRule = "@request.auth.id = id && @request.body.isInstitution:isset = false"

  return app.save(collection)
})
