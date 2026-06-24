/// <reference path="../pb_data/types.d.ts" />

// Round 2 (PR review): public / self-join groups.
//   - adds `isPublic` (bool) to groups;
//   - public groups are readable (name + description) by any authenticated user,
//     so prospective members can see what they'd join;
//   - members may self-join a public group (insert their OWN member row); the
//     owner can still add others directly. Private groups stay invite-only.
migrate((app) => {
    const groups = app.findCollectionByNameOrId('pbc_groups00001')
    groups.fields.add(new Field({
        hidden: false,
        id: 'bool_groups_ispublic',
        name: 'isPublic',
        type: 'bool',
        required: false,
        presentable: false,
        system: false,
    }))
    const groupsRead = '@request.auth.id = owner || group_members_via_group.user.id ?= @request.auth.id || isPublic = true'
    groups.listRule = groupsRead
    groups.viewRule = groupsRead
    app.save(groups)

    const members = app.findCollectionByNameOrId('pbc_groupmem001')
    // Owner adds anyone; on a public group a user may add THEMSELVES (self-join),
    // but only as a plain `member` — a self-joiner must not grant themselves the
    // `admin` role (groundwork-safety for future co-admin authorization).
    members.createRule = '@request.auth.id = group.owner || (group.isPublic = true && @request.auth.id = user && role = "member")'
    app.save(members)
}, (app) => {
    const groups = app.findCollectionByNameOrId('pbc_groups00001')
    const groupsReadOld = '@request.auth.id = owner || group_members_via_group.user.id ?= @request.auth.id'
    groups.listRule = groupsReadOld
    groups.viewRule = groupsReadOld
    groups.fields.removeById('bool_groups_ispublic')
    app.save(groups)

    const members = app.findCollectionByNameOrId('pbc_groupmem001')
    members.createRule = '@request.auth.id = group.owner'
    app.save(members)
})
