/// <reference path="../pb_data/types.d.ts" />

// Mask trustees-only item details in the public items_public view and drop the
// owner's trusts list. Non-trusted/guests get only metadata (category, status,
// owner) for trustees items — name/description/images are NULL. Trusted users
// read full details from the base `items` collection (trust-gated, see next
// migration). This closes the public leak of trustees item details + the trust
// graph via items_public.
migrate(
    (app) => {
        const c = app.findCollectionByNameOrId('items_public')
        c.viewQuery = [
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
        app.save(c)
    },
    (app) => {
        const c = app.findCollectionByNameOrId('items_public')
        c.viewQuery = [
            'SELECT ',
            '  items.id, items.name, items.image, items.externalImgUrl, items.externalUrl, items.description, items.trusteesOnly, items.status, items.categories, items.updated,',
            '  users.id as userId, users.username, users.trusts, users.isInstitution, users.bio, users.verified, users.profileImage, users.created as userCreated,',
            '  (',
            "    ug.geolocation IS NOT NULL AND ug.geolocation != '' AND NOT (json_extract(ug.geolocation, '$.lon') = 0 AND json_extract(ug.geolocation, '$.lat') = 0)",
            '  ) AS ownerHasLocation',
            'FROM items',
            'LEFT JOIN users on items.owner = users.id',
            'LEFT JOIN user_geolocations ug on ug.user = users.id',
        ].join('\n')
        app.save(c)
    }
)
