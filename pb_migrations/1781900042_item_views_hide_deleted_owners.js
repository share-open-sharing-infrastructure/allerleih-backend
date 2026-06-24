/// <reference path="../pb_data/types.d.ts" />

// When a user deletes their account, items still referenced by a conversation cannot
// be deleted (conversations.requestedItem is a required relation) and are kept so the
// counterparty's loan history stays intact. Exclude such items (owner.deleted = true)
// from the public catalogue and search views so a deleted account's listings disappear
// from discovery while the conversation can still resolve the item directly.
//
// We *append* the filter to whatever the view query currently is rather than rewriting
// it, so this works regardless of any other branch's view changes (e.g. the groups
// feature adds an `items.groups` column + rules). Both views join `users` and end
// without a WHERE clause, so appending is safe; field columns are unchanged, so the
// existing access rules stay valid.
const FILTER = 'WHERE COALESCE(users.deleted, 0) = 0'

migrate(
    (app) => {
        for (const name of ['items_searchable', 'items_public']) {
            const v = app.findCollectionByNameOrId(name)
            const q = v.viewQuery.trimEnd()
            if (!q.includes(FILTER)) {
                v.viewQuery = q + '\n' + FILTER
                app.save(v)
            }
        }
    },
    (app) => {
        for (const name of ['items_searchable', 'items_public']) {
            const v = app.findCollectionByNameOrId(name)
            v.viewQuery = v.viewQuery.replace('\n' + FILTER, '').replace(FILTER, '').trimEnd()
            app.save(v)
        }
    }
)
