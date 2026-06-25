/// <reference path="../pb_data/types.d.ts" />

// The search page sorts the default (nothing-searched) catalogue by item creation date,
// newest first, as social proof that new listings keep arriving. The `items_searchable`
// view originally selected `items.updated` but not `items.created`, so `-created` could not
// be sorted on. Append `items.created` to the view's SELECT and re-save so PocketBase
// re-derives the field list (adding a `created` autodate field). String-append style mirrors
// the `…_item_views_hide_deleted_owners` migration so it survives other view changes.
migrate(
  (app) => {
    const v = app.findCollectionByNameOrId('items_searchable')
    if (!v.viewQuery.includes('items.created')) {
      v.viewQuery = v.viewQuery.replace('items.updated,', 'items.updated, items.created,')
      app.save(v)
    }
  },
  (app) => {
    const v = app.findCollectionByNameOrId('items_searchable')
    v.viewQuery = v.viewQuery.replace('items.updated, items.created,', 'items.updated,')
    app.save(v)
  }
)
