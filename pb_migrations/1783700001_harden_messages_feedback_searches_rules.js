/// <reference path="../pb_data/types.d.ts" />

// Tighten three collection rules at the data layer:
//   1. messages.createRule — a message must be authored by the caller (`from` =
//      caller), the caller must be a participant of the referenced conversation,
//      and the recipient must be the conversation's other participant. Mirrors the
//      participant model already enforced on conversations.
//   2. feedback.listRule / searches.listRule — superusers only (these are internal
//      analytics/log collections). createRule stays "" so feedback submissions and
//      search logging still work; viewRule was already superuser-only.

const MESSAGES_CREATE =
    '@request.auth.id != "" && @request.auth.id = from && ' +
    '(conversation.requester = @request.auth.id || conversation.itemOwner = @request.auth.id) && ' +
    '(to = conversation.requester || to = conversation.itemOwner) && to != from'

migrate(
    (app) => {
        const messages = app.findCollectionByNameOrId('messages')
        messages.createRule = MESSAGES_CREATE
        app.save(messages)

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
        app.save(messages)

        const feedback = app.findCollectionByNameOrId('feedback')
        feedback.listRule = ''
        app.save(feedback)

        const searches = app.findCollectionByNameOrId('searches')
        searches.listRule = ''
        app.save(searches)
    }
)
