/// <reference path="../pb_data/types.d.ts" />

// Extend the search view so group members find group-shared trustees items.
// We add items.groups to the SELECT (PB infers it as a relation field, enabling
// the back-relation traversal) and widen the row-level rule with the same group
// clause used on the base items collection. Public items stay visible to all;
// trustees items remain restricted to owner + owner's trustees + group members.
const SELECT_WITH_GROUPS = [
    'SELECT',
    '  items.id, items.name, items.image, items.externalImgUrl, items.externalUrl, items.description,',
    '  items.trusteesOnly, items.status, items.categories, items.groups, items.updated,',
    '  users.id as userId, users.username, users.isInstitution, users.bio, users.verified, users.profileImage, users.created as userCreated,',
    '  (',
    "    ug.geolocation IS NOT NULL AND ug.geolocation != '' AND NOT (json_extract(ug.geolocation, '$.lon') = 0 AND json_extract(ug.geolocation, '$.lat') = 0)",
    '  ) AS ownerHasLocation',
    'FROM items',
    'LEFT JOIN users on items.owner = users.id',
    'LEFT JOIN user_geolocations ug on ug.user = users.id',
].join('\n')

const SELECT_ORIGINAL = [
    'SELECT',
    '  items.id, items.name, items.image, items.externalImgUrl, items.externalUrl, items.description,',
    '  items.trusteesOnly, items.status, items.categories, items.updated,',
    '  users.id as userId, users.username, users.isInstitution, users.bio, users.verified, users.profileImage, users.created as userCreated,',
    '  (',
    "    ug.geolocation IS NOT NULL AND ug.geolocation != '' AND NOT (json_extract(ug.geolocation, '$.lon') = 0 AND json_extract(ug.geolocation, '$.lat') = 0)",
    '  ) AS ownerHasLocation',
    'FROM items',
    'LEFT JOIN users on items.owner = users.id',
    'LEFT JOIN user_geolocations ug on ug.user = users.id',
].join('\n')

const RULE_WITH_GROUPS =
    'trusteesOnly = false || (@request.auth.id != "" && (@request.auth.id = userId || userId.trusts.id ?= @request.auth.id || groups.group_members_via_group.user.id ?= @request.auth.id))'

const RULE_ORIGINAL =
    'trusteesOnly = false || (@request.auth.id != "" && (@request.auth.id = userId || userId.trusts.id ?= @request.auth.id))'

migrate((app) => {
    const c = app.findCollectionByNameOrId('pbc_1350744161')
    c.viewQuery = SELECT_WITH_GROUPS
    c.listRule = RULE_WITH_GROUPS
    c.viewRule = RULE_WITH_GROUPS
    return app.save(c)
}, (app) => {
    const c = app.findCollectionByNameOrId('pbc_1350744161')
    c.viewQuery = SELECT_ORIGINAL
    c.listRule = RULE_ORIGINAL
    c.viewRule = RULE_ORIGINAL
    return app.save(c)
})
