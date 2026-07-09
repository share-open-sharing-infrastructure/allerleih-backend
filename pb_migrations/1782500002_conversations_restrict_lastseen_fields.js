/// <reference path="../pb_data/types.d.ts" />

// Restrict the conversations updateRule so each participant can only write their own
// *LastSeenAt field. Without this, a requester could PATCH ownerLastSeenAt (or vice
// versa) and permanently suppress the other party's email notifications.

const UPDATE_RULE_NEW =
    '(@request.auth.id = requester && @request.body.ownerLastSeenAt:isset = false) || (@request.auth.id = itemOwner && @request.body.requesterLastSeenAt:isset = false)'

const UPDATE_RULE_PREV =
    '@request.auth.id = itemOwner || @request.auth.id = requester'

migrate((app) => {
    const conv = app.findCollectionByNameOrId('conversations')
    conv.updateRule = UPDATE_RULE_NEW
    return app.save(conv)
}, (app) => {
    const conv = app.findCollectionByNameOrId('conversations')
    conv.updateRule = UPDATE_RULE_PREV
    return app.save(conv)
})
