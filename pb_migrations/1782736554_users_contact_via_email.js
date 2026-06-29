/// <reference path="../pb_data/types.d.ts" />

// Issue #438 "Contact via mail": some owners (e.g. the Lüneburg student body with a
// physical lending process) don't want to run requests through the platform. Two new
// fields on the user record let an owner opt into being contacted by email instead:
//   contactViaEmail — when true, the owner's items render a mailto: CTA instead of
//     starting the in-app request flow.
//   contactEmail    — the address the mailto: points at. A DEDICATED address, kept
//     separate from the private login `email`, so the login mail is never exposed.
//
// Both are user-settable: the existing users updateRule (`@request.auth.id = id ...`)
// already lets the owner write their own record, and neither field is on the rule's
// :isset block-list, so no rule change is needed.
//
// PRIVACY: contactEmail must reach OTHER users only when they are authenticated. The
// base `users` viewRule is `@request.auth.id != ""`, so any logged-in viewer can read
// it — but it is deliberately NOT added to any *_public / items_searchable view, so it
// never leaks to unauthenticated browsing or scrapers (leak check: those views select
// an explicit column list; this field is simply absent from all three).
migrate((app) => {
  const c = app.findCollectionByNameOrId("hbacudkt08pfcy3") // users

  c.fields.add(new Field({
    "hidden": false,
    "id": "bool_user_contact_via_email",
    "name": "contactViaEmail",
    "presentable": false,
    "required": false,
    "system": false,
    "type": "bool"
  }))

  c.fields.add(new Field({
    "exceptDomains": null,
    "hidden": false,
    "id": "email_user_contact_email",
    "name": "contactEmail",
    "onlyDomains": null,
    "presentable": false,
    "required": false,
    "system": false,
    "type": "email"
  }))

  return app.save(c)
}, (app) => {
  const c = app.findCollectionByNameOrId("hbacudkt08pfcy3") // users

  c.fields.removeById("bool_user_contact_via_email")
  c.fields.removeById("email_user_contact_email")

  return app.save(c)
})
