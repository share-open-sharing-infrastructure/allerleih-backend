/// <reference path="../pb_data/types.d.ts" />

// Issue #368 "Improve lending flow for external items" — a per-institution, free-text
// explanation of HOW to borrow an externally-provided item (owner has isInstitution = true
// and the item carries an externalUrl). Shown as a permanent info box on the item-detail
// page; when empty the frontend falls back to a shared default text (texts.institutional).
//
//   externalLendingInfo — text (max 1000). Optional. Lives on the OWNER's `users` record
//     (one process explanation per institution, NOT per imported item), so importing/refresh
//     never has to carry it.
//
// USER-SETTABLE: the existing users updateRule
//   `@request.auth.id = id && @request.body.isInstitution:isset = false && ...`
// does NOT list externalLendingInfo on its :isset block-list, so an institution can maintain
// this field via a normal self-update (the profile form's ?/saveProfile action). It is NOT a
// server-only/hidden field like the legal-consent fields.
//
// PRIVACY: this is a public help text (no PII), so it is exposed to unauthenticated browsing
// via a masked `items_public` column (see 1783800001_items_public_expose_lending_info.js),
// but deliberately NOT added to users_public or items_searchable.
migrate((app) => {
  const c = app.findCollectionByNameOrId("hbacudkt08pfcy3") // users

  c.fields.add(new Field({
    "hidden": false,
    "id": "text_user_ext_lending_info",
    "name": "externalLendingInfo",
    "presentable": false,
    "required": false,
    "system": false,
    "type": "text",
    "max": 1000,
    "min": 0,
    "pattern": ""
  }))

  return app.save(c)
}, (app) => {
  const c = app.findCollectionByNameOrId("hbacudkt08pfcy3") // users

  c.fields.removeById("text_user_ext_lending_info")

  return app.save(c)
})
