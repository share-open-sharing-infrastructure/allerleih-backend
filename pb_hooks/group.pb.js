/// <reference path="../pb_data/types.d.ts" />

// Group invite links. Two endpoints, both operating in elevated context so they
// can read invites that API rules keep private (no public listing -> no token
// enumeration, matching invite.pb.js):
//
//   GET  /api/group-invite/{token}        -> preview {group:{id,name}, valid}
//   POST /api/group-invite/{token}/join   -> join the group (requires auth)
//
// Group/membership lifecycle (owner deletes account -> group gone; group
// deleted -> memberships + item references dropped) is handled by cascadeDelete
// on the relations, so it needs no hook here.
//
// NOTE: each handler runs in its own isolated JS context, so shared helpers are
// require()'d from services/group.js *inside* the handler, not at file scope.

// When a group is deleted, protect items shared ONLY with that group and not
// visible to trustees: once the relation ref is cascade-removed they'd become
// trusteesOnly=false + no groups == PUBLIC, silently exposing an item the owner
// only ever shared with a group. Flip those to trustees-only (private) first.
// Runs for the record-level delete paths the app uses (API, admin, owner-account
// cascade). NOTE: a raw DB truncate of `groups` would bypass this hook — the app
// never does that, but it's the one path the guarantee doesn't cover.
onRecordDelete((e) => {
    const gid = e.record.id
    try {
        // Relation membership must be filtered via `groups.id ?= ...` (plain
        // `groups ?= ...` matches nothing here). Page through ALL matches — a
        // fixed cap would silently leave the overflow public. Flipping only
        // toggles trusteesOnly, so the `groups.id ?= gid` result set is stable
        // across pages. The JS guard re-checks the real groups array (sole group).
        // Page size is env-overridable so tests can force multi-page traversal.
        const PAGE = parseInt($os.getenv('GROUP_FIXUP_PAGE')) || 200
        let offset = 0
        for (;;) {
            const candidates = e.app.findRecordsByFilter('items', 'groups.id ?= {:g}', '', PAGE, offset, { g: gid })
            for (const it of candidates) {
                const grps = Array.from(it.get('groups') || [])
                if (!it.get('trusteesOnly') && grps.length === 1 && grps[0] === gid) {
                    it.set('trusteesOnly', true)
                    e.app.save(it)
                }
            }
            if (candidates.length < PAGE) break
            offset += PAGE
        }
    } catch (err) {
        // A failed flip must NOT proceed to delete the group (that would cascade-
        // remove the ref and leak the item). Re-throw so the whole delete rolls
        // back — failing safe is better than a silent public exposure.
        e.app.logger().error('[group-delete-fixup] aborting group delete', 'error', String(err))
        throw err
    }
    e.next()
}, 'groups')

// When a group is created, add its owner as an `admin` member. Modeling the
// owner as a real member row means the owner sees items members shared with the
// group, is counted in the roster, and gives us the groundwork for co-admins.
// Runs in elevated context, so it bypasses the group_members create rule.
onRecordAfterCreateSuccess((e) => {
    const ownerId = e.record.getString('owner')
    if (!ownerId) {
        e.next()
        return
    }
    try {
        // Idempotent against the unique (group,user) index: never double-insert
        // (defensive against retries / overlap with the one-time backfill).
        let existing = null
        try {
            existing = e.app.findFirstRecordByFilter(
                'group_members',
                'group = {:g} && user = {:u}',
                { g: e.record.id, u: ownerId }
            )
        } catch (_) {
            existing = null
        }
        if (!existing) {
            const m = new Record(e.app.findCollectionByNameOrId('group_members'))
            m.set('group', e.record.id)
            m.set('user', ownerId)
            m.set('role', 'admin')
            e.app.save(m)
        }
    } catch (err) {
        // The owner MUST exist as an admin member or core invariants break (owner
        // can't see member-shared items, roster/count are wrong, the admin-leave
        // guard has nothing to protect). Rather than leave an ownerless group,
        // roll the group back and surface the failure instead of swallowing it.
        e.app.logger().error('[group-create] owner admin membership failed; rolling back group', 'error', String(err))
        try {
            e.app.delete(e.record)
        } catch (delErr) {
            e.app.logger().error('[group-create] rollback delete failed', 'error', String(delErr))
        }
        throw new BadRequestError('Gruppe konnte nicht vollständig angelegt werden.')
    }
    e.next()
}, 'groups')

// Default any membership without an explicit role to `member`. Select fields
// have no schema default, so a row created via the bare collection API (e.g. the
// owner adding someone directly) would otherwise have an empty role. The
// owner-admin hook and the self-join path set their roles explicitly, so this
// only fills the gap for the owner-add path. (Self-join is separately constrained
// to role="member" by the createRule, evaluated on the request before this runs.)
onRecordCreate((e) => {
    if (!e.record.getString('role')) {
        e.record.set('role', 'member')
    }
    e.next()
}, 'group_members')

// Public preview: show who you've been invited to join before logging in.
routerAdd('GET', '/api/group-invite/{token}', (e) => {
    const { resolveInvite } = require(`${__hooks}/services/group.js`)
    const token = e.request.pathValue('token')
    const { invite, reason } = resolveInvite(token)

    if (!invite) {
        return e.json(404, { valid: false, reason: 'not_found' })
    }
    if (reason) {
        // Token exists but can't be used (expired / used up).
        return e.json(410, { valid: false, reason: reason })
    }

    let group
    try {
        group = $app.findRecordById('groups', invite.getString('group'))
    } catch (_) {
        return e.json(404, { valid: false, reason: 'not_found' })
    }

    return e.json(200, {
        valid: true,
        group: { id: group.id, name: group.getString('name') },
    })
})

// Join via invite. Idempotent: already-members (and the owner) succeed without
// consuming a use.
routerAdd(
    'POST',
    '/api/group-invite/{token}/join',
    (e) => {
        const { resolveInvite } = require(`${__hooks}/services/group.js`)
        const token = e.request.pathValue('token')
        const me = e.auth.id

        const { invite, reason } = resolveInvite(token)
        if (!invite) {
            return e.json(404, { joined: false, reason: 'not_found' })
        }
        if (reason) {
            return e.json(410, { joined: false, reason: reason })
        }

        const groupId = invite.getString('group')
        let group
        try {
            group = $app.findRecordById('groups', groupId)
        } catch (_) {
            return e.json(404, { joined: false, reason: 'not_found' })
        }

        // The owner is implicitly part of their own group.
        if (group.getString('owner') === me) {
            return e.json(200, {
                joined: true,
                alreadyMember: true,
                group: { id: group.id, name: group.getString('name') },
            })
        }

        // Create the membership and bump the usage counter atomically. Doing the
        // maxUses re-check, the membership create and the uses++ in one
        // transaction closes the TOCTOU race where N concurrent joins could all
        // pass the cap, and keeps the counter consistent with the membership.
        // 'joined' | 'already' (idempotent) | 'used_up' (cap reached in the race window)
        let outcome = 'joined'
        try {
            $app.runInTransaction((txApp) => {
                // Re-read inside the transaction for an up-to-date usage count.
                const fresh = txApp.findRecordById('group_invites', invite.id)
                const maxUses = Number(fresh.get('maxUses')) || 0
                const uses = Number(fresh.get('uses')) || 0
                if (maxUses > 0 && uses >= maxUses) {
                    outcome = 'used_up'
                    return
                }

                // Already a member? Succeed without consuming a use.
                try {
                    txApp.findFirstRecordByFilter(
                        'group_members',
                        'group = {:g} && user = {:u}',
                        { g: groupId, u: me },
                    )
                    outcome = 'already'
                    return
                } catch (_) {
                    // not a member yet -> create below
                }

                const collection = txApp.findCollectionByNameOrId('group_members')
                const member = new Record(collection)
                member.set('group', groupId)
                member.set('user', me)
                member.set('role', 'member')
                txApp.save(member)

                fresh.set('uses', uses + 1)
                txApp.save(fresh)
            })
        } catch (_) {
            // Most likely the unique (group,user) index firing on a concurrent
            // same-user join -> the membership exists, so treat it as idempotent.
            // Anything else (and no membership) is a genuine failure.
            try {
                $app.findFirstRecordByFilter(
                    'group_members',
                    'group = {:g} && user = {:u}',
                    { g: groupId, u: me },
                )
                outcome = 'already'
            } catch (_) {
                return e.json(500, { joined: false, reason: 'error' })
            }
        }

        if (outcome === 'used_up') {
            return e.json(410, { joined: false, reason: 'used_up' })
        }

        return e.json(200, {
            joined: true,
            alreadyMember: outcome === 'already',
            group: { id: group.id, name: group.getString('name') },
        })
    },
    $apis.requireAuth(),
)
