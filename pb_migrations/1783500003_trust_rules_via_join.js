/// <reference path="../pb_data/types.d.ts" />

// Repoint every trust-visibility rule from the old users.trusts[] multi-relation
// to the new `trusts` join collection, via the `truster` back-relation. The trust
// clause `X.trusts.id ?= @request.auth.id` (X = owner / userId / requestedItem.owner)
// becomes `X.trusts_via_truster.trustee.id ?= @request.auth.id`, mirroring how the
// items rules already traverse group_members (`groups.group_members_via_group...`).
// We string-swap the *live* rule so this survives sibling edits to the surrounding
// clauses (the conversations createRule in particular has been rewritten twice).
const OLD = 'trusts.id ?= @request.auth.id'
const NEW = 'trusts_via_truster.trustee.id ?= @request.auth.id'

// Replace `from` with `to` in a rule string, asserting it was actually present so
// a drifted rule fails loudly instead of silently skipping the trust migration.
function swap(rule, from, to) {
    if (!rule || rule.indexOf(from) === -1) {
        throw new Error('trust clause "' + from + '" not found in rule: ' + rule)
    }
    return rule.split(from).join(to)
}

function apply(app, from, to) {
    const items = app.findCollectionByNameOrId('qyvc6pcix0fuqis')
    items.listRule = swap(items.listRule, from, to)
    items.viewRule = swap(items.viewRule, from, to)
    app.save(items)

    const searchable = app.findCollectionByNameOrId('pbc_1350744161')
    searchable.listRule = swap(searchable.listRule, from, to)
    searchable.viewRule = swap(searchable.viewRule, from, to)
    app.save(searchable)

    const conversations = app.findCollectionByNameOrId('conversations')
    conversations.createRule = swap(conversations.createRule, from, to)
    app.save(conversations)
}

migrate(
    (app) => apply(app, OLD, NEW),
    (app) => apply(app, NEW, OLD)
)
