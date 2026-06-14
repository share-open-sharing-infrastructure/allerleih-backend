/// <reference path="../pb_data/types.d.ts" />

/**
 * Creates the `items_public` SQL view.
 *
 * This is a read-only view that joins items with users for the search feature.
 * It never exposes raw geolocation coordinates — only `ownerHasLocation` (0 or 1).
 *
 * IMPORTANT: This SQL must match your actual PocketBase view definition.
 * You may need to adjust this after exporting the real schema from the live instance.
 */
migrate((app) => {
    const collection = new Collection({
        "name": "items_public",
        "type": "view",
        "system": false,
        "fields": [],
        "listRule": "",
        "viewRule": "",
        "viewQuery": `
            SELECT
                items.id AS id,
                items.name AS name,
                items.image AS image,
                items.externalImgUrl AS externalImgUrl,
                items.externalUrl AS externalUrl,
                items.description AS description,
                items.trusteesOnly AS trusteesOnly,
                items.status AS status,
                items.categories AS categories,
                items.updated AS updated,
                users.id AS userId,
                users.username AS username,
                users.trusts AS trusts,
                users.isInstitution AS isInstitution,
                users.bio AS bio,
                users.verified AS verified,
                users.profileImage AS profileImage,
                users.created AS userCreated,
                CASE
                    WHEN users.geolocation IS NOT NULL
                         AND json_extract(users.geolocation, '$.lon') != 0
                         AND json_extract(users.geolocation, '$.lat') != 0
                    THEN 1
                    ELSE 0
                END AS ownerHasLocation
            FROM items
            INNER JOIN users ON items.owner = users.id
            WHERE items.status != 'unavailable'
        `,
    })

    return app.save(collection)
}, (app) => {
    const collection = app.findCollectionByNameOrId('items_public')
    return app.delete(collection)
})
