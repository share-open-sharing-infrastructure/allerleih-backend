/// <reference path="../pb_data/types.d.ts" />

/**
 * #487 Phase 3 (final) — remove the interim discovery fields `leihbackendUrl` +
 * `leihbackendItemUrlTemplate` from `users` (collection id `hbacudkt08pfcy3`).
 *
 * Discovery moved to the `sync_config` collection in Phase 2, and Phase 3 removed the last
 * runtime readers (the frontend integration core + the manual /api/sync,/api/refresh endpoints),
 * so these two columns are dead.
 *
 * ⚠️ HONEST down(): re-adds the two columns (so the schema shape reverts), but **NOT their
 * values** — SQLite drops the column and its data on `up()`, and the values now live in
 * `sync_config` (backfilled in Phase 2). A revert therefore leaves the columns empty; that is
 * acceptable because nothing reads them anymore. **PR checklist: verify the `sync_config` backfill
 * is complete before running this migration in production.**
 */
migrate((app) => {
    const collection = app.findCollectionByNameOrId('hbacudkt08pfcy3') // users
    collection.fields.removeById('url2339978314') // leihbackendUrl
    collection.fields.removeById('text4020674105') // leihbackendItemUrlTemplate
    return app.save(collection)
}, (app) => {
    const collection = app.findCollectionByNameOrId('hbacudkt08pfcy3') // users
    collection.fields.add(
        new Field({
            id: 'url2339978314',
            name: 'leihbackendUrl',
            type: 'url',
            hidden: true,
            required: false,
            presentable: false,
            system: false,
            exceptDomains: [],
            onlyDomains: [],
        })
    )
    collection.fields.add(
        new Field({
            id: 'text4020674105',
            name: 'leihbackendItemUrlTemplate',
            type: 'text',
            hidden: true,
            required: false,
            presentable: false,
            primaryKey: false,
            system: false,
            min: 0,
            max: 0,
            pattern: '',
            autogeneratePattern: '',
        })
    )
    return app.save(collection)
})
