/// <reference path="../pb_data/types.d.ts" />

// Mirror the independent trustees/groups model in the search view's rule:
// a row is public only if it's neither trustees-only NOR group-shared; otherwise
// it's visible to the owner, the owner's trustees (only when trusteesOnly), and
// members of any attached group.
const RULE_INDEPENDENT =
    '(trusteesOnly = false && groups:length = 0) || (@request.auth.id != "" && (@request.auth.id = userId || (trusteesOnly = true && userId.trusts.id ?= @request.auth.id) || groups.group_members_via_group.user.id ?= @request.auth.id))'

const RULE_UNION =
    'trusteesOnly = false || (@request.auth.id != "" && (@request.auth.id = userId || userId.trusts.id ?= @request.auth.id || groups.group_members_via_group.user.id ?= @request.auth.id))'

migrate((app) => {
    const c = app.findCollectionByNameOrId('pbc_1350744161')
    c.listRule = RULE_INDEPENDENT
    c.viewRule = RULE_INDEPENDENT
    return app.save(c)
}, (app) => {
    const c = app.findCollectionByNameOrId('pbc_1350744161')
    c.listRule = RULE_UNION
    c.viewRule = RULE_UNION
    return app.save(c)
})
