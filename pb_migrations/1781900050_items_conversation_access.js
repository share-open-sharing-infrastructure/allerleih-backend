/// <reference path="../pb_data/types.d.ts" />

// Two fixes around conversations:
//
// 1) A conversation participant must always be able to VIEW the requested item,
//    even after losing group/trust access — otherwise the conversation list and
//    detail (which expand requestedItem) break for e.g. a borrower who was
//    removed from the group they borrowed through. Add a clause to the items
//    view/list rule granting access to the requester of a conversation about it.
//    (The owner already sees their own items via the owner clause.)
//
// 2) The conversations createRule still used the pre-independent-model notion of
//    "public" (trusteesOnly = false). Align it with the items visibility model so
//    group members can request group items and non-members cannot request a
//    group-only item (trusteesOnly = false but not public).

const ITEMS_RULE_WITH_CONV =
    '@request.auth.id != "" && (@request.auth.id = owner || (trusteesOnly = false && groups:length = 0) || (trusteesOnly = true && owner.trusts.id ?= @request.auth.id) || groups.group_members_via_group.user.id ?= @request.auth.id || (@collection.conversations.requestedItem ?= id && @collection.conversations.requester ?= @request.auth.id))'

const ITEMS_RULE_PREV =
    '@request.auth.id != "" && (@request.auth.id = owner || (trusteesOnly = false && groups:length = 0) || (trusteesOnly = true && owner.trusts.id ?= @request.auth.id) || groups.group_members_via_group.user.id ?= @request.auth.id)'

const CONV_CREATE_NEW =
    '@request.auth.id != "" && @request.auth.id = requester && ((requestedItem.trusteesOnly = false && requestedItem.groups:length = 0) || requestedItem.owner = @request.auth.id || (requestedItem.trusteesOnly = true && requestedItem.owner.trusts.id ?= @request.auth.id) || requestedItem.groups.group_members_via_group.user.id ?= @request.auth.id)'

const CONV_CREATE_PREV =
    '@request.auth.id != "" && @request.auth.id = requester && (requestedItem.trusteesOnly = false || requestedItem.owner = @request.auth.id || requestedItem.owner.trusts.id ?= @request.auth.id)'

migrate((app) => {
    const items = app.findCollectionByNameOrId('qyvc6pcix0fuqis')
    items.listRule = ITEMS_RULE_WITH_CONV
    items.viewRule = ITEMS_RULE_WITH_CONV
    app.save(items)

    const conv = app.findCollectionByNameOrId('conversations')
    conv.createRule = CONV_CREATE_NEW
    app.save(conv)
}, (app) => {
    const items = app.findCollectionByNameOrId('qyvc6pcix0fuqis')
    items.listRule = ITEMS_RULE_PREV
    items.viewRule = ITEMS_RULE_PREV
    app.save(items)

    const conv = app.findCollectionByNameOrId('conversations')
    conv.createRule = CONV_CREATE_PREV
    app.save(conv)
})
