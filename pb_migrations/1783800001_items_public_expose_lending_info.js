/// <reference path="../pb_data/types.d.ts" />

// Issue #368 — expose the owner's per-institution "how the lending works" explanation
// (users.externalLendingInfo) to UNauthenticated browsing of the item-detail page, so a
// logged-out visitor sees the process hint on an external/institution item.
//
// items_public is read without auth and masks restricted items' content (see
// 1782750000_items_public_expose_contact.js, whose SELECT this extends). We add ONE derived
// column:
//   ownerExternalLendingInfo — the owner's explanation, or NULL.
//
// MASKING — unlike the ownerContact* columns (#438), there is NO contactPublic gate here:
// externalLendingInfo is a public help text with no PII, so it is exposed whenever the item
// itself is exposed. It is masked with exactly the same MASK condition as the item's own
// content columns (name/description/image), i.e. NULL for any trusteesOnly or group-shared
// item — a restricted item isn't visible to anonymous browsing, so its help text mustn't ride
// along either. externalLendingInfo is never added to users_public or items_searchable.

const MASK = "(items.trusteesOnly OR (items.groups != '' AND items.groups != '[]'))"
const PUBLIC_CONTACT = `(NOT ${MASK} AND users.contactPublic)`

// New view: SELECT_WITH_CONTACT (current view, from 1782750000) + ownerExternalLendingInfo.
const SELECT_WITH_LENDING_INFO = [
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
    `  (CASE WHEN ${MASK} THEN NULL ELSE users.externalLendingInfo END) AS ownerExternalLendingInfo,`,
    '  (',
    "    ug.geolocation IS NOT NULL AND ug.geolocation != '' AND NOT (json_extract(ug.geolocation, '$.lon') = 0 AND json_extract(ug.geolocation, '$.lat') = 0)",
    '  ) AS ownerHasLocation',
    'FROM items',
    'LEFT JOIN users on items.owner = users.id',
    'LEFT JOIN user_geolocations ug on ug.user = users.id',
].join('\n')

// The prior view (1782750000_items_public_expose_contact.js) — restored by down().
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

migrate((app) => {
    const c = app.findCollectionByNameOrId('pbc_2268005888')
    c.viewQuery = SELECT_WITH_LENDING_INFO
    return app.save(c)
}, (app) => {
    const c = app.findCollectionByNameOrId('pbc_2268005888')
    c.viewQuery = SELECT_WITH_CONTACT
    return app.save(c)
})
