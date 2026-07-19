/// <reference path="../pb_data/types.d.ts" />

// Whitelist thumbnail sizes so the frontend can request downscaled images
// (#456: search cards downloaded the full multi-MB originals). PocketBase only
// generates a `?thumb=WxH` variant when the size is listed in the file field's
// `thumbs` option — with an empty whitelist it silently serves the original.
//
// - items.image → '0x300': resize to 300px height preserving aspect ratio; the
//   card's object-cover CSS does the (single) crop.
// - users.profileImage → '100x100': center crop for the round avatar chips.
//
// Item files are served through the `items_searchable` view (and profile images
// may be exposed via `users_public`), whose cloned file fields carry their own
// options — each view must be re-saved so PocketBase re-derives the clone with
// the new whitelist (same pattern as 1783500000_items_image_multi.js). Views
// are re-saved defensively (an env may not have all) and fields are resolved by
// name so the migration is independent of generated field ids.
const ITEM_THUMBS = ['0x300']
const PROFILE_THUMBS = ['100x100']
const VIEWS = ['items_public', 'items_searchable', 'users_public']

function setThumbs(app, itemThumbs, profileThumbs) {
    const items = app.findCollectionByNameOrId('items')
    const image = items.fields.getByName('image')
    if (image) {
        image.thumbs = itemThumbs
        app.save(items)
    }
    const users = app.findCollectionByNameOrId('users')
    const profileImage = users.fields.getByName('profileImage')
    if (profileImage) {
        profileImage.thumbs = profileThumbs
        app.save(users)
    }
    for (const name of VIEWS) {
        try {
            app.save(app.findCollectionByNameOrId(name))
        } catch {
            // View not present in this environment — nothing to re-derive.
        }
    }
}

migrate(
    (app) => setThumbs(app, ITEM_THUMBS, PROFILE_THUMBS),
    (app) => setThumbs(app, [], [])
)
