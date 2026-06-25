/// <reference path="../pb_data/types.d.ts" />

// Restricted audit store for deleted accounts. When a user deletes their account
// the live `users` row is anonymized, but the original email + username are copied
// here so the operator can still identify/contact the person in case of a dispute
// (GDPR Art. 17(3)(e) — defence of legal claims). All access rules are null, so the
// collection is reachable only by superusers — the retained identifiers never reach
// the client or any view. A future purge job removes these rows once the retention
// window (see privacy statement) has elapsed.
migrate(
    (app) => {
        const collection = new Collection({
            createRule: null,
            listRule: null,
            viewRule: null,
            updateRule: null,
            deleteRule: null,
            fields: [
                {
                    autogeneratePattern: '[a-z0-9]{15}',
                    hidden: false,
                    id: 'text3208210256',
                    max: 15,
                    min: 15,
                    name: 'id',
                    pattern: '^[a-z0-9]+$',
                    presentable: false,
                    primaryKey: true,
                    required: true,
                    system: true,
                    type: 'text',
                },
                {
                    cascadeDelete: false,
                    collectionId: 'hbacudkt08pfcy3',
                    hidden: false,
                    id: 'relation_da_user',
                    maxSelect: 1,
                    minSelect: 0,
                    name: 'user',
                    presentable: false,
                    required: false,
                    system: false,
                    type: 'relation',
                },
                {
                    autogeneratePattern: '',
                    hidden: false,
                    id: 'text_da_email',
                    max: 0,
                    min: 0,
                    name: 'email',
                    pattern: '',
                    presentable: false,
                    primaryKey: false,
                    required: false,
                    system: false,
                    type: 'text',
                },
                {
                    autogeneratePattern: '',
                    hidden: false,
                    id: 'text_da_username',
                    max: 0,
                    min: 0,
                    name: 'username',
                    pattern: '',
                    presentable: false,
                    primaryKey: false,
                    required: false,
                    system: false,
                    type: 'text',
                },
                {
                    hidden: false,
                    id: 'date_da_deletedAt',
                    max: '',
                    min: '',
                    name: 'deletedAt',
                    presentable: false,
                    required: false,
                    system: false,
                    type: 'date',
                },
                {
                    hidden: false,
                    id: 'autodate_da_created',
                    name: 'created',
                    onCreate: true,
                    onUpdate: false,
                    presentable: false,
                    system: false,
                    type: 'autodate',
                },
            ],
            id: 'pbc_deleted_accounts',
            indexes: ['CREATE INDEX `idx_da_user` ON `deleted_accounts` (`user`)'],
            name: 'deleted_accounts',
            system: false,
            type: 'base',
        })

        return app.save(collection)
    },
    (app) => {
        const collection = app.findCollectionByNameOrId('pbc_deleted_accounts')

        return app.delete(collection)
    }
)
