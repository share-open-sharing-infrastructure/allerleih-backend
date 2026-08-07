/// <reference path="../pb_data/types.d.ts" />

// Business-metrics project: nightly snapshot storage for the /admin/metrics and
// /misc/stats pages (share-mvp repo). One row per calendar day (`date`, unique),
// upserted by the metrics cron job (metrics.pb.js). `metrics` is a single JSON blob
// rather than typed columns deliberately — new aggregates can be added to the catalog
// without a migration, since only the computing job and the reading app code need to
// agree on the shape.
//
// All five API rules are null: this collection is superuser-only. Nothing here is
// per-user data (every value is a count/aggregate), but exposure to the admin
// dashboard and the public stats page is still an app-code decision (an explicit
// whitelist), not a PocketBase rule — see docs/operations/metrics.md.
migrate(
    (app) => {
        const collection = new Collection({
            createRule: null,
            deleteRule: null,
            listRule: null,
            viewRule: null,
            updateRule: null,
            fields: [
                {
                    autogeneratePattern: '[a-z0-9]{15}',
                    hidden: false,
                    id: 'text_metrics_daily_id',
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
                    hidden: false,
                    id: 'text_metrics_daily_date',
                    max: 10,
                    min: 10,
                    name: 'date',
                    pattern: '^\\d{4}-\\d{2}-\\d{2}$',
                    presentable: true,
                    required: true,
                    system: false,
                    type: 'text',
                },
                {
                    hidden: false,
                    id: 'json_metrics_daily_metrics',
                    maxSize: 2000000,
                    name: 'metrics',
                    presentable: false,
                    required: false,
                    system: false,
                    type: 'json',
                },
                {
                    hidden: false,
                    id: 'autodate_metrics_daily_created',
                    name: 'created',
                    onCreate: true,
                    onUpdate: false,
                    presentable: false,
                    system: false,
                    type: 'autodate',
                },
                {
                    hidden: false,
                    id: 'autodate_metrics_daily_updated',
                    name: 'updated',
                    onCreate: true,
                    onUpdate: true,
                    presentable: false,
                    system: false,
                    type: 'autodate',
                },
            ],
            id: 'pbc_metrics_daily',
            indexes: ['CREATE UNIQUE INDEX `idx_metrics_daily_date` ON `metrics_daily` (`date`)'],
            name: 'metrics_daily',
            system: false,
            type: 'base',
        })

        return app.save(collection)
    },
    (app) => {
        return app.delete(app.findCollectionByNameOrId('pbc_metrics_daily'))
    }
)
