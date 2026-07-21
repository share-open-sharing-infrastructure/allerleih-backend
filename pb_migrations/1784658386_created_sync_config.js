/// <reference path="../pb_data/types.d.ts" />

/**
 * #487 Phase 2 — `sync_config`: per-institution integration configuration for the backend
 * catalogue sync/refresh. Replaces the overloaded `users.leihbackendUrl` discovery mechanism
 * (which stays in place until Phase 3 for the frontend manual/CSV paths).
 *
 * superuser-only: all five access rules are `null` (managed via the PocketBase admin UI + the
 * onboarding runbook — no frontend admin screen, no user-facing CRUD). `null` (not `""`) means
 * "no one but a superuser", where `""` would mean "everyone".
 *
 * Unique `(institution, integration)` — one config row per source type per institution.
 */
migrate((app) => {
    const collection = new Collection({
        name: 'sync_config',
        id: 'pbc_syncconfig01',
        type: 'base',
        listRule: null,
        viewRule: null,
        createRule: null,
        updateRule: null,
        deleteRule: null,
        fields: [
            {
                name: 'institution',
                type: 'relation',
                collectionId: 'hbacudkt08pfcy3', // users
                cascadeDelete: true,
                required: true,
                maxSelect: 1,
            },
            {
                name: 'integration',
                type: 'select',
                required: true,
                maxSelect: 1,
                values: ['leihbackend', 'winbiap'],
            },
            { name: 'baseUrl', type: 'text', required: true },
            { name: 'itemUrlTemplate', type: 'text', required: false },
            { name: 'enabled', type: 'bool', required: false },
            { name: 'created', type: 'autodate', onCreate: true },
            { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
        ],
        indexes: [
            'CREATE UNIQUE INDEX `idx_sync_config_institution_integration` ON `sync_config` (`institution`, `integration`)',
        ],
    })
    return app.save(collection)
}, (app) => {
    return app.delete(app.findCollectionByNameOrId('pbc_syncconfig01'))
})
