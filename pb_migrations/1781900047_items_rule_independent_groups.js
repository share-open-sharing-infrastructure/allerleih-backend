/// <reference path="../pb_data/types.d.ts" />

// Make trustees-visibility and group-visibility INDEPENDENT on items.
// New model:
//   public            := trusteesOnly = false AND no groups attached
//   visible to trustees if trusteesOnly = true
//   visible to a group's members if that group is attached
// i.e. selecting a group no longer implies the trust list, and an item can be
// shared with groups only (trusteesOnly = false but groups set) without becoming
// public. The owner always sees their own items.
migrate((app) => {
    const c = app.findCollectionByNameOrId('qyvc6pcix0fuqis')
    const rule =
        '@request.auth.id != "" && (@request.auth.id = owner || (trusteesOnly = false && groups:length = 0) || (trusteesOnly = true && owner.trusts.id ?= @request.auth.id) || groups.group_members_via_group.user.id ?= @request.auth.id)'
    c.listRule = rule
    c.viewRule = rule
    return app.save(c)
}, (app) => {
    const c = app.findCollectionByNameOrId('qyvc6pcix0fuqis')
    // Restore the union rule from 1781900044.
    const rule =
        '@request.auth.id != "" && (trusteesOnly = false || @request.auth.id = owner || owner.trusts.id ?= @request.auth.id || groups.group_members_via_group.user.id ?= @request.auth.id)'
    c.listRule = rule
    c.viewRule = rule
    return app.save(c)
})
