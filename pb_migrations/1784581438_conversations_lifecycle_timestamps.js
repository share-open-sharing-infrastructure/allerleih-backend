/// <reference path="../pb_data/types.d.ts" />

// Business-metrics project: `acceptedAt` / `completedAt` record the first time a
// conversation's lendingStatus transitioned into 'accepted' / 'completed', so
// time-based metrics (funnel, 30d active users, etc.) can be computed without relying
// on `updated` (which is bumped by unrelated writes like lastSeenAt pings).
//
// Both fields are stamped server-side by the onRecordUpdate hook in
// lending_timestamps.pb.js — never trust a client-supplied value for these (see that
// hook for why the updateRule alone doesn't block it). No backfill: pre-deployment
// conversations simply have no timestamp, so time-based metrics only accumulate from
// here forward (documented limitation, not a bug).

migrate(
    (app) => {
        const c = app.findCollectionByNameOrId('conversations')
        c.fields.add(new Field({ type: 'date', id: 'date_accepted_at', name: 'acceptedAt', required: false }))
        c.fields.add(new Field({ type: 'date', id: 'date_completed_at', name: 'completedAt', required: false }))
        return app.save(c)
    },
    (app) => {
        const c = app.findCollectionByNameOrId('conversations')
        c.fields.removeById('date_accepted_at')
        c.fields.removeById('date_completed_at')
        return app.save(c)
    }
)
