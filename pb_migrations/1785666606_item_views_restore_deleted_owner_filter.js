/// <reference path="../pb_data/types.d.ts" />

// Issue #624 — re-append the deleted-owner filter to both item views.
//
// 1781900042_item_views_hide_deleted_owners.js introduced this clause: when a user deletes
// their account, items still referenced by a conversation cannot be deleted
// (conversations.requestedItem is a required relation) and are kept (as `unavailable`) so the
// counterparty's loan history stays intact. Those rows must not reappear in the guest
// catalogue or in search.
//
// The clause was appended by string concatenation, so it lived only in the stored query — and
// four later migrations reassigned `viewQuery` without carrying it over:
//   - items_searchable: 1781900045_items_searchable_groups.js            <- dropped it
//   - items_public:     1781900049_items_public_mask_grouped.js          <- dropped it
//                    -> 1782750000_items_public_expose_contact.js        <- rewrote it away again
//                    -> 1783800001_items_public_expose_lending_info.js   <- rewrote it away again
// So there were two actual drop events (the first per view); the two follow-ups rebuilt an
// already clause-less query, and their `down()`s restore a clause-less one too. As of the last
// one neither view had a WHERE clause at all, i.e. a deleted account's items were back in
// discovery. This migration restores the clause; it does not touch the SELECT.
//
// COALESCE, not a bare `users.deleted = 0`: both views `LEFT JOIN users on items.owner =
// users.id`, so an item with a missing/dangling owner row yields NULL for `users.deleted`, and
// `NULL = 0` is NULL — SQLite would silently drop that row from the view. COALESCE(..., 0)
// treats "no owner row" as "not deleted" and keeps it.
//
// tests/deleted-owner-items.test.mjs is the guard: besides the behavioural assertions it reads
// both views' live `viewQuery` and fails if the clause is gone, so the next wholesale rewrite
// goes red instead of quietly re-opening this hole.
//
// As before, we *append* to whatever the view query currently is rather than rewriting it, so
// this works regardless of any other branch's view changes. Both views end with their LEFT
// JOINs and carry no GROUP BY / ORDER BY / LIMIT, so appending is safe; the derived field list
// is unchanged, so the existing list/view rules stay valid.
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
