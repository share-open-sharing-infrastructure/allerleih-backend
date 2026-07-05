/// <reference path="../pb_data/types.d.ts" />

// Fix a visibility regression in the conversations createRule.
//
// 1781900050 aligned the rule with the independent visibility model:
//   public == (trusteesOnly = false AND groups:length = 0), plus owner / trustee /
//   group-member clauses — so a non-member could NOT request a group-only item
//   (trusteesOnly = false but shared with a group).
// 1782260002 then added the `itemOwner = requestedItem.owner` binding (defense in
//   depth for the lending-requirements gate) but, in doing so, reverted the
//   visibility clause back to the pre-independent-model `trusteesOnly = false`,
//   dropping the `groups:length = 0` public-check AND the group-member clause.
//   Result: a non-member CAN start a conversation for a group-only item.
//
// This migration keeps the itemOwner binding and restores the correct visibility
// model (public requires an empty groups relation; group members are matched via
// the group_members join, mirroring the items list/view rule).

const CONV_CREATE_FIXED =
    '@request.auth.id != "" && @request.auth.id = requester && itemOwner = requestedItem.owner && ((requestedItem.trusteesOnly = false && requestedItem.groups:length = 0) || requestedItem.owner = @request.auth.id || (requestedItem.trusteesOnly = true && requestedItem.owner.trusts.id ?= @request.auth.id) || requestedItem.groups.group_members_via_group.user.id ?= @request.auth.id)'

// Previous (buggy) rule from 1782260002 — restored on down.
const CONV_CREATE_PREV =
    '@request.auth.id != "" && @request.auth.id = requester && itemOwner = requestedItem.owner && (requestedItem.trusteesOnly = false || requestedItem.owner = @request.auth.id || requestedItem.owner.trusts.id ?= @request.auth.id)'

migrate(
    (app) => {
        const c = app.findCollectionByNameOrId('conversations')
        c.createRule = CONV_CREATE_FIXED
        app.save(c)
    },
    (app) => {
        const c = app.findCollectionByNameOrId('conversations')
        c.createRule = CONV_CREATE_PREV
        app.save(c)
    }
)
