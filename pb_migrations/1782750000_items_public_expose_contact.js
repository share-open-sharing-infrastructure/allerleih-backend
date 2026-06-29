/// <reference path="../pb_data/types.d.ts" />

// Issue #438 — expose an owner's off-platform contact CTA to UNauthenticated browsing,
// but ONLY when the owner opted in (contactPublic = true) AND only for that owner's
// fully-public items.
//
// items_public is read without auth and masks restricted items' content (see
// 1782900049_items_public_mask_grouped.js). The base `users` viewRule requires auth, so
// an anonymous visitor can't read contactEmail/contactUrl directly — the item detail page
// therefore reads the public contact from this view instead. We surface three derived
// columns, each NULL unless the owner chose the matching method and made it public:
//   ownerContactMethod — '' | 'email' | 'link'
//   ownerContactEmail  — the address (only when method = 'email')
//   ownerContactUrl    — the https destination (only when method = 'link')
//
// PRIVACY — two gates, both in SQL so they cannot be bypassed by an anonymous read:
//   1. users.contactPublic must be true (owner explicitly opted into public exposure).
//      contactPublic = false → members-only; the columns stay NULL here and the logged-in
//      item-detail load reads them from the base `users` record instead.
//   2. The item must NOT be masked (the same trustees-only/group condition the rest of the
//      view uses). A restricted item isn't visible to anonymous browsing, so its owner's
//      contact must not ride along with it either.
// contactEmail/contactUrl are never added to users_public or items_searchable, so the
// members-only case never leaks. (Leak check: tests/account.test.mjs.)

const MASK = "(items.trusteesOnly OR (items.groups != '' AND items.groups != '[]'))"
const PUBLIC_CONTACT = `(NOT ${MASK} AND users.contactPublic)`

const SELECT_WITH_CONTACT = [
    'SELECT',
    '  items.id,',
    `  (CASE WHEN ${MASK} THEN NULL ELSE items.name END) AS name,`,
    `  (CASE WHEN ${MASK} THEN NULL ELSE items.image END) AS image,`,
    `  (CASE WHEN ${MASK} THEN NULL ELSE items.externalImgUrl END) AS externalImgUrl,`,
    `  (CASE WHEN ${MASK} THEN NULL ELSE items.externalUrl END) AS externalUrl,`,
    `  (CASE WHEN ${MASK} THEN NULL ELSE items.description END) AS description,`,
    '  items.trusteesOnly, items.status, items.categories, items.updated,',
    '  users.id as userId, users.username, users.isInstitution, users.bio, users.verified, users.profileImage, users.created as userCreated,',
    `  (CASE WHEN ${PUBLIC_CONTACT} AND users.contactMethod != '' THEN users.contactMethod ELSE NULL END) AS ownerContactMethod,`,
    `  (CASE WHEN ${PUBLIC_CONTACT} AND users.contactMethod = 'email' THEN users.contactEmail ELSE NULL END) AS ownerContactEmail,`,
    `  (CASE WHEN ${PUBLIC_CONTACT} AND users.contactMethod = 'link' THEN users.contactUrl ELSE NULL END) AS ownerContactUrl,`,
    '  (',
    "    ug.geolocation IS NOT NULL AND ug.geolocation != '' AND NOT (json_extract(ug.geolocation, '$.lon') = 0 AND json_extract(ug.geolocation, '$.lat') = 0)",
    '  ) AS ownerHasLocation',
    'FROM items',
    'LEFT JOIN users on items.owner = users.id',
    'LEFT JOIN user_geolocations ug on ug.user = users.id',
].join('\n')

// The prior view (1781900049_items_public_mask_grouped.js) — restored by down().
const SELECT_MASK_BOTH = [
    'SELECT',
    '  items.id,',
    `  (CASE WHEN ${MASK} THEN NULL ELSE items.name END) AS name,`,
    `  (CASE WHEN ${MASK} THEN NULL ELSE items.image END) AS image,`,
    `  (CASE WHEN ${MASK} THEN NULL ELSE items.externalImgUrl END) AS externalImgUrl,`,
    `  (CASE WHEN ${MASK} THEN NULL ELSE items.externalUrl END) AS externalUrl,`,
    `  (CASE WHEN ${MASK} THEN NULL ELSE items.description END) AS description,`,
    '  items.trusteesOnly, items.status, items.categories, items.updated,',
    '  users.id as userId, users.username, users.isInstitution, users.bio, users.verified, users.profileImage, users.created as userCreated,',
    '  (',
    "    ug.geolocation IS NOT NULL AND ug.geolocation != '' AND NOT (json_extract(ug.geolocation, '$.lon') = 0 AND json_extract(ug.geolocation, '$.lat') = 0)",
    '  ) AS ownerHasLocation',
    'FROM items',
    'LEFT JOIN users on items.owner = users.id',
    'LEFT JOIN user_geolocations ug on ug.user = users.id',
].join('\n')

migrate((app) => {
    const c = app.findCollectionByNameOrId('pbc_2268005888')
    c.viewQuery = SELECT_WITH_CONTACT
    return app.save(c)
}, (app) => {
    const c = app.findCollectionByNameOrId('pbc_2268005888')
    c.viewQuery = SELECT_MASK_BOTH
    return app.save(c)
})
