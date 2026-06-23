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
        // Mask trustees-only content (name/image/links/description -> NULL) via a
        // self-join to `items` that only matches non-trustees rows, instead of a
        // CASE expression. PocketBase derives a view field's type from its source
        // column; a CASE expression has no source column, so `image` would be typed
        // as `json` and the file API (/api/files/...) would refuse to serve it,
        // breaking image display for ALL items. Referencing `vis.image` keeps the
        // field a direct column reference to items.image, so it stays a `file`
        // field, while a missing join match yields NULL for masked rows.
        c.viewQuery = [
            'SELECT',
            '  items.id,',
            '  vis.name AS name,',
            '  vis.image AS image,',
            '  vis.externalImgUrl AS externalImgUrl,',
            '  vis.externalUrl AS externalUrl,',
            '  vis.description AS description,',
            '  items.trusteesOnly, items.status, items.categories, items.updated,',
            '  users.id as userId, users.username, users.isInstitution, users.bio, users.verified, users.profileImage, users.created as userCreated,',
            '  (',
            "    ug.geolocation IS NOT NULL AND ug.geolocation != '' AND NOT (json_extract(ug.geolocation, '$.lon') = 0 AND json_extract(ug.geolocation, '$.lat') = 0)",
            '  ) AS ownerHasLocation',
            'FROM items',
            '  LEFT JOIN items vis on vis.id = items.id AND NOT items.trusteesOnly',
            '  LEFT JOIN users on items.owner = users.id',
            '  LEFT JOIN user_geolocations ug on ug.user = users.id',
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
