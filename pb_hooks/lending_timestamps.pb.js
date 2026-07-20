/// <reference path="../pb_data/types.d.ts" />

// Business-metrics project: stamp `acceptedAt` / `completedAt` on `conversations` the
// first time lendingStatus transitions into 'accepted' / 'completed'. Using
// onRecordUpdate (not onRecordUpdateRequest) means this fires for EVERY save path —
// the frontend lending actions, admin UI, direct API PATCHes, other hooks' elevated
// $app.save() calls — not just HTTP record-update requests, so no path can skip it.
//
// SECURITY: the conversations updateRule only restricts the two *LastSeenAt fields
// (see 1782500002_conversations_restrict_lastseen_fields.js); it does not enumerate
// the full field surface, so a PATCH could otherwise set acceptedAt/completedAt to an
// arbitrary forged value. Both fields are therefore reset to their PERSISTED original
// before the transition check runs, discarding whatever the client sent — the only
// way either field can end up with a value is the stamping logic below.
//
// Idempotent: once stamped, a value is never overwritten. This means aborting an
// accepted request and later re-accepting it keeps the FIRST acceptedAt, matching
// "when did this conversation first reach this state" rather than "most recently".
onRecordUpdate((e) => {
    const { now } = require(`${__hooks}/utils/common.js`)
    const orig = e.record.original()

    const origAcceptedAt = orig.getString('acceptedAt')
    const origCompletedAt = orig.getString('completedAt')
    e.record.set('acceptedAt', origAcceptedAt)
    e.record.set('completedAt', origCompletedAt)

    const prevStatus = orig.getString('lendingStatus')
    const nextStatus = e.record.getString('lendingStatus')

    if (nextStatus === 'accepted' && prevStatus !== 'accepted' && !origAcceptedAt) {
        e.record.set('acceptedAt', now())
    }
    if (nextStatus === 'completed' && prevStatus !== 'completed' && !origCompletedAt) {
        e.record.set('completedAt', now())
    }

    e.next()
}, 'conversations')
