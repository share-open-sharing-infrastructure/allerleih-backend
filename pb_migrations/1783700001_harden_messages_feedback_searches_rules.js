/// <reference path="../pb_data/types.d.ts" />

// Tighten over-permissive collection rules at the data layer:
//   1. messages.createRule — a message must be authored by the caller (`from` =
//      caller), the caller must be a participant of the referenced conversation,
//      and the recipient must be the conversation's other participant.
//   2. messages.updateRule / deleteRule — set to superusers-only. Messages have no
//      user-editable fields (read-tracking lives on `conversations`), and the
//      frontend never updates or deletes a message; leaving these as
//      `from || to` let a participant PATCH a stored message to rewrite
//      from/to/conversation/content (forging authorship / re-homing it), which
//      would undo the createRule authorship guarantee. Account/retention deletes
//      run via $app (superuser) and are unaffected.
//   3. notifications.createRule — require an authenticated caller who is the
//      `sender`. The previous rule (recipient || relatedId || sender) had no
//      `!= ""` guard, so an UNauthenticated caller satisfied it with empty
//      optional fields (`"" = relatedId`). All legit notification creates set
//      sender = the acting user. The notification_guard hook additionally checks
//      the event is real; this closes the unauthenticated path at the rule layer.
//   4. feedback.listRule / searches.listRule — superusers only (internal
//      analytics/log collections). createRule stays "" so feedback submissions and
//      search logging still work; viewRule was already superuser-only.

const MESSAGES_CREATE =
    '@request.auth.id != "" && @request.auth.id = from && ' +
    '(conversation.requester = @request.auth.id || conversation.itemOwner = @request.auth.id) && ' +
    '(to = conversation.requester || to = conversation.itemOwner) && to != from'

const NOTIFICATIONS_CREATE = '@request.auth.id != "" && @request.auth.id = sender'
const NOTIFICATIONS_CREATE_OLD =
    '@request.auth.id = recipient || @request.auth.id = relatedId || @request.auth.id = sender'
const FROM_OR_TO = '@request.auth.id = from || @request.auth.id = to'

migrate(
    (app) => {
        const messages = app.findCollectionByNameOrId('messages')
        messages.createRule = MESSAGES_CREATE
        messages.updateRule = null
        messages.deleteRule = null
        app.save(messages)

        const notifications = app.findCollectionByNameOrId('notifications')
        notifications.createRule = NOTIFICATIONS_CREATE
        app.save(notifications)

        const feedback = app.findCollectionByNameOrId('feedback')
        feedback.listRule = null
        app.save(feedback)

        const searches = app.findCollectionByNameOrId('searches')
        searches.listRule = null
        app.save(searches)
    },
    (app) => {
        const messages = app.findCollectionByNameOrId('messages')
        messages.createRule = '@request.auth.id != ""'
        messages.updateRule = FROM_OR_TO
        messages.deleteRule = FROM_OR_TO
        app.save(messages)

        const notifications = app.findCollectionByNameOrId('notifications')
        notifications.createRule = NOTIFICATIONS_CREATE_OLD
        app.save(notifications)

        const feedback = app.findCollectionByNameOrId('feedback')
        feedback.listRule = ''
        app.save(feedback)

        const searches = app.findCollectionByNameOrId('searches')
        searches.listRule = ''
        app.save(searches)
    }
)
