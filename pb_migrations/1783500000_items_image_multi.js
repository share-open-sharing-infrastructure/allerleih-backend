/// <reference path="../pb_data/types.d.ts" />

// Allow multiple images per item (#246). The `image` file field started as
// maxSelect: 1 (a single file); widen it to a small array so an item can carry
// several photos. Existing single-image records keep their image (PocketBase
// migrates the stored value to a one-element array).
//
// The `items_public` and `items_searchable` views project `items.image`
// verbatim, so their SQL is unchanged — but each must be re-saved so PocketBase
// re-derives its cloned `image` file field with the new maxSelect. Without the
// re-save the view API would still treat `image` as a single file and return
// only the first filename. Views are re-saved defensively (an env may not have
// both) and `image` is resolved by name so the migration is independent of the
// field's generated id.
const MULTI = 5
const SINGLE = 1
const VIEWS = ['items_public', 'items_searchable']

function setImageMaxSelect(app, maxSelect) {
    const items = app.findCollectionByNameOrId('items')
    const image = items.fields.getByName('image')
    if (image) {
        image.maxSelect = maxSelect
        app.save(items)
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
    (app) => setImageMaxSelect(app, MULTI),
    (app) => setImageMaxSelect(app, SINGLE)
)
