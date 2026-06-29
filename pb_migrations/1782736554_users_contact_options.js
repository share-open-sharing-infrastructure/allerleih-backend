/// <reference path="../pb_data/types.d.ts" />

// Issue #438 "Contact off-platform": some owners (e.g. the Lüneburg student body with a
// physical lending process, or an institution running its own lending form) don't want
// requests to go through the platform's in-app flow. These fields on the user record let
// an owner opt into an alternative contact channel that replaces the in-app "Anfragen":
//   contactMethod  — select: '' (off, default) | 'email' | 'link'. When set, the owner's
//     items render a contact CTA instead of starting the in-app request flow.
//   contactEmail   — the address the mailto: CTA points at when contactMethod = 'email'.
//     A DEDICATED address, kept separate from the private login `email`, so the login
//     mail is never exposed.
//   contactUrl     — the (https) destination the CTA links to when contactMethod = 'link'
//     (e.g. an institution's external lending form), routed through /api/redirect.
//   contactPublic  — when true, the contact CTA is also shown to UNauthenticated browsers
//     (institutions that want zero-account access). When false (default), only logged-in
//     viewers see it.
//
// All are user-settable: the existing users updateRule (`@request.auth.id = id ...`)
// already lets the owner write their own record, and none of these fields are on the
// rule's :isset block-list, so no rule change is needed.
//
// PRIVACY: contactEmail / contactUrl are off-platform PII chosen by the owner.
//   - For contactPublic = false they reach OTHER users only when authenticated: the base
//     `users` viewRule is `@request.auth.id != ""`, and these fields are deliberately NOT
//     added to users_public / items_searchable, so they never leak to anonymous browsing.
//   - For contactPublic = true the owner has explicitly opted into public exposure; the
//     `items_public` view (see 1782750000_items_public_expose_contact.js) surfaces them as
//     ownerContact* columns, but ONLY for that owner's UNmasked (fully public) items.
migrate((app) => {
  const c = app.findCollectionByNameOrId("hbacudkt08pfcy3") // users

  c.fields.add(new Field({
    "hidden": false,
    "id": "select_user_contact_method",
    "name": "contactMethod",
    "presentable": false,
    "required": false,
    "system": false,
    "type": "select",
    "maxSelect": 1,
    "values": ["email", "link"]
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

  c.fields.add(new Field({
    "hidden": false,
    "id": "url_user_contact_url",
    "name": "contactUrl",
    "presentable": false,
    "required": false,
    "system": false,
    "type": "url",
    "exceptDomains": null,
    "onlyDomains": null
  }))

  c.fields.add(new Field({
    "hidden": false,
    "id": "bool_user_contact_public",
    "name": "contactPublic",
    "presentable": false,
    "required": false,
    "system": false,
    "type": "bool"
  }))

  return app.save(c)
}, (app) => {
  const c = app.findCollectionByNameOrId("hbacudkt08pfcy3") // users

  c.fields.removeById("select_user_contact_method")
  c.fields.removeById("email_user_contact_email")
  c.fields.removeById("url_user_contact_url")
  c.fields.removeById("bool_user_contact_public")

  return app.save(c)
})
