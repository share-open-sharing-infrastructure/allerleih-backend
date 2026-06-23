/// <reference path="../pb_data/types.d.ts" />

// items_public is fully public (no auth) and masks restricted items' content.
// Under the independent model an item is restricted when it's trustees-only OR
// shared with at least one group, so the mask condition must cover both —
// otherwise a group-only item (trusteesOnly = false) would leak its name /
// description / images to everyone. Empty multi-relation is stored as '' / '[]'
// / NULL, all of which count as "no groups".
const MASK = "(items.trusteesOnly OR (items.groups != '' AND items.groups != '[]'))"

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

const SELECT_MASK_TRUSTEES_ONLY = [
    'SELECT',
    '  items.id,',
    '  (CASE WHEN items.trusteesOnly THEN NULL ELSE items.name END) AS name,',
    '  (CASE WHEN items.trusteesOnly THEN NULL ELSE items.image END) AS image,',
    '  (CASE WHEN items.trusteesOnly THEN NULL ELSE items.externalImgUrl END) AS externalImgUrl,',
    '  (CASE WHEN items.trusteesOnly THEN NULL ELSE items.externalUrl END) AS externalUrl,',
    '  (CASE WHEN items.trusteesOnly THEN NULL ELSE items.description END) AS description,',
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
    c.viewQuery = SELECT_MASK_BOTH
    return app.save(c)
}, (app) => {
    const c = app.findCollectionByNameOrId('pbc_2268005888')
    c.viewQuery = SELECT_MASK_TRUSTEES_ONLY
    return app.save(c)
})
