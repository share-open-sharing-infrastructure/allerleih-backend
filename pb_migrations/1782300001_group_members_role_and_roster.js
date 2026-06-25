/// <reference path="../pb_data/types.d.ts" />

// Round 2 (PR review): model the group OWNER as a member with role `admin`.
//   - adds a `role` select field (admin | member) to group_members;
//   - backfills existing invited members to `member` and inserts an `admin`
//     membership row for each group's owner (so the owner is a real member);
//   - relaxes list/view so ANY group member can read the full roster (fixes the
//     "member sees only themselves / wrong member count" bug), and lets the owner
//     set roles (updateRule) — groundwork for co-admins.
// With the owner now a member row, the items visibility rule needs no change:
// its `groups.group_members_via_group.user.id ?= @request.auth.id` clause now
// also matches the owner, so the owner sees items members shared with the group.
migrate((app) => {
    const c = app.findCollectionByNameOrId('pbc_groupmem001')

    c.fields.add(new Field({
        hidden: false,
        id: 'select_gm_role',
        name: 'role',
        type: 'select',
        required: false,
        presentable: false,
        maxSelect: 1,
        values: ['admin', 'member'],
        system: false,
    }))

    // Any member of the group may read the roster; the owner may change roles.
    const roster = '@request.auth.id = group.owner || group.group_members_via_group.user.id ?= @request.auth.id'
    c.listRule = roster
    c.viewRule = roster
    c.updateRule = '@request.auth.id = group.owner'
    // Owner removes anyone / a member leaves — EXCEPT the owner's own admin row
    // (that would orphan the group; the owner deletes the whole group instead).
    // cascadeDelete bypasses API rules, so group deletion still clears it.
    c.deleteRule = '(@request.auth.id = group.owner || @request.auth.id = user) && (role != "admin" || user != group.owner)'

    app.save(c)

    // Backfill existing invited members -> role 'member'.
    for (const m of app.findAllRecords('group_members')) {
        if (!m.getString('role')) {
            m.set('role', 'member')
            app.save(m)
        }
    }

    // Backfill: ensure every group's owner is an admin member row.
    for (const g of app.findAllRecords('groups')) {
        const ownerId = g.getString('owner')
        if (!ownerId) continue
        let exists = false
        try {
            app.findFirstRecordByFilter('group_members', 'group = {:g} && user = {:u}', { g: g.id, u: ownerId })
            exists = true
        } catch (_) {
            /* none */
        }
        if (!exists) {
            const rec = new Record(c)
            rec.set('group', g.id)
            rec.set('user', ownerId)
            rec.set('role', 'admin')
            app.save(rec)
        }
    }
}, (app) => {
    const c = app.findCollectionByNameOrId('pbc_groupmem001')

    // Remove the backfilled owner-admin membership rows.
    for (const g of app.findAllRecords('groups')) {
        const ownerId = g.getString('owner')
        if (!ownerId) continue
        try {
            const m = app.findFirstRecordByFilter('group_members', 'group = {:g} && user = {:u}', { g: g.id, u: ownerId })
            app.delete(m)
        } catch (_) {
            /* none */
        }
    }

    // Restore the original owner-or-self rules and drop the role field.
    const original = '@request.auth.id = group.owner || @request.auth.id = user'
    c.listRule = original
    c.viewRule = original
    c.deleteRule = original
    c.updateRule = null
    c.fields.removeById('select_gm_role')
    app.save(c)
})
