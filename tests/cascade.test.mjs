// Lifecycle / cascadeDelete edge cases — the design's "what happens when an
// account or a group goes away" rules, enforced by PocketBase relations:
//   groups.owner          cascadeDelete -> owner account deleted => group gone
//   group_members.group   cascadeDelete -> group deleted => memberships gone
//   group_members.user    cascadeDelete -> member account deleted => membership gone
//   group_invites.group   cascadeDelete -> group deleted => invites gone
//   items.groups          cascadeDelete FALSE -> group deleted => ref dropped, item stays
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { startPB, stopPB, makeUser, api, adminAuth } from './harness.mjs'

let pb

before(async () => {
	pb = await startPB()
})

after(() => stopPB(pb))

// owner creates a group + an invite a member joins. No item: in this schema a
// user who still OWNS items cannot be deleted (items.owner is required &
// cascadeDelete=false — a pre-existing constraint, the real account-deletion
// flow removes the user's items first), so to isolate the GROUP cascade we
// delete an owner whose only footprint is the group.
async function setupJoinedGroup(owner, member) {
	const g = await api('POST', '/api/collections/groups/records', owner.t, { name: 'Casc', owner: owner.id })
	assert.equal(g.status, 200)
	const inv = await api('POST', '/api/collections/group_invites/records', owner.t, { group: g.json.id })
	assert.equal(inv.status, 200)
	const join = await api('POST', `/api/group-invite/${inv.json.token}/join`, member.t)
	assert.equal(join.status, 200)
	// the invited member must land as a plain `member` (not admin)
	const memberRow = await api(
		'GET',
		`/api/collections/group_members/records?filter=${encodeURIComponent(`group="${g.json.id}" && user="${member.id}"`)}`,
		owner.t
	)
	assert.equal(memberRow.json.totalItems, 1, 'joined member has a membership row')
	assert.equal(memberRow.json.items[0].role, 'member', 'invited member gets role=member')
	return { groupId: g.json.id, token: inv.json.token, inviteId: inv.json.id }
}

test('deleting the owner account cascades: group, its members and its invites all vanish', async () => {
	const owner = await makeUser('castowner')
	const member = await makeUser('castmember')
	const { groupId, token } = await setupJoinedGroup(owner, member)

	// sanity: the member is in, and the group/invite exist
	// owner (admin) + the joined member
	assert.equal(
		(await api('GET', `/api/collections/group_members/records?filter=${encodeURIComponent(`group="${groupId}"`)}`, adminAuth())).json.totalItems,
		2
	)

	// owner deletes their account (via admin — cascade is DB-level, trigger-agnostic)
	const del = await api('DELETE', `/api/collections/users/records/${owner.id}`, adminAuth())
	assert.ok([200, 204].includes(del.status), 'owner account deleted')

	// the group is gone
	assert.equal((await api('GET', `/api/collections/groups/records/${groupId}`, adminAuth())).status, 404, 'group cascade-deleted')
	// its memberships are gone
	assert.equal(
		(await api('GET', `/api/collections/group_members/records?filter=${encodeURIComponent(`group="${groupId}"`)}`, adminAuth())).json.totalItems,
		0,
		'memberships cascade-deleted'
	)
	// its invite no longer resolves
	assert.equal((await api('GET', `/api/group-invite/${token}`)).status, 404, 'invite cascade-deleted')
})

test('a member deleting their account removes only their membership; group and other members remain', async () => {
	const owner = await makeUser('mowner')
	const m1 = await makeUser('mone')
	const m2 = await makeUser('mtwo')

	const g = await api('POST', '/api/collections/groups/records', owner.t, { name: 'Stay', owner: owner.id })
	const groupId = g.json.id
	await api('POST', '/api/collections/group_members/records', owner.t, { group: groupId, user: m1.id })
	await api('POST', '/api/collections/group_members/records', owner.t, { group: groupId, user: m2.id })

	// m1 deletes their account
	const del = await api('DELETE', `/api/collections/users/records/${m1.id}`, adminAuth())
	assert.ok([200, 204].includes(del.status))

	// m1's membership is gone; owner (admin) + m2 remain; the group is intact
	const rows = await api('GET', `/api/collections/group_members/records?filter=${encodeURIComponent(`group="${groupId}"`)}`, owner.t)
	const userIds = rows.json.items.map((r) => r.user)
	assert.equal(rows.json.totalItems, 2, 'owner + m2 remain')
	assert.ok(userIds.includes(m2.id), 'm2 remains')
	assert.ok(!userIds.includes(m1.id), 'm1 is gone')
	assert.equal((await api('GET', `/api/collections/groups/records/${groupId}`, owner.t)).status, 200, 'group still exists')
})

test('deleting a group removes its invites (token stops resolving)', async () => {
	const owner = await makeUser('gowner')
	const g = await api('POST', '/api/collections/groups/records', owner.t, { name: 'Doomed', owner: owner.id })
	const inv = await api('POST', '/api/collections/group_invites/records', owner.t, { group: g.json.id })
	const token = inv.json.token

	assert.equal((await api('GET', `/api/group-invite/${token}`)).status, 200, 'invite works before delete')

	assert.ok([200, 204].includes((await api('DELETE', `/api/collections/groups/records/${g.json.id}`, owner.t)).status))

	assert.equal((await api('GET', `/api/group-invite/${token}`)).status, 404, 'preview gone after group delete')
	assert.equal((await api('POST', `/api/group-invite/${token}/join`, owner.t)).status, 404, 'join gone after group delete')
})

test('an item shared with MULTIPLE groups is NOT flipped when only one group is deleted', async () => {
	const owner = await makeUser('mgowner')
	const gA = (await api('POST', '/api/collections/groups/records', owner.t, { name: 'mgA', owner: owner.id })).json.id
	const gB = (await api('POST', '/api/collections/groups/records', owner.t, { name: 'mgB', owner: owner.id })).json.id
	const it = await api('POST', '/api/collections/items/records', owner.t, {
		name: 'MultiGroup', description: 'd', place: 'p', owner: owner.id,
		trusteesOnly: false, groups: [gA, gB], status: 'available',
	})
	const itemId = it.json.id

	// delete only group A
	assert.ok([200, 204].includes((await api('DELETE', `/api/collections/groups/records/${gA}`, owner.t)).status))

	// the item keeps group B and must NOT be flipped to trustees-only (still group-only via B)
	const v = await api('GET', `/api/collections/items/records/${itemId}`, owner.t)
	assert.equal(v.json.trusteesOnly, false, 'still group-only, not flipped')
	assert.deepEqual(v.json.groups, [gB], 'only group A removed, B remains')
})

// The harness runs PocketBase with GROUP_FIXUP_PAGE=3, so 7 items span THREE
// pages of the fixup hook's offset loop — this exercises the multi-page
// pagination that replaced the old 500-item cap (overflow used to leak public).
// NOTE: the hook's fail-safe rollback (a failed flip re-throws so the whole
// group delete aborts rather than leaking the rest) is intentionally left
// untested — inducing an item save() failure would require test-only scaffolding
// in production hooks; the path is a 3-line log-then-throw verified by reading.
test('ALL group-only items in a deleted group are flipped to private (spans multiple pages)', async () => {
	const owner = await makeUser('bulkowner')
	const g = (await api('POST', '/api/collections/groups/records', owner.t, { name: 'Bulk', owner: owner.id })).json.id
	const ids = []
	for (let i = 0; i < 7; i++) {
		const it = await api('POST', '/api/collections/items/records', owner.t, {
			name: `Bulk-${i}`, description: 'd', place: 'p', owner: owner.id,
			trusteesOnly: false, groups: [g], status: 'available',
		})
		ids.push(it.json.id)
	}

	assert.ok([200, 204].includes((await api('DELETE', `/api/collections/groups/records/${g}`, owner.t)).status))

	for (const id of ids) {
		const v = await api('GET', `/api/collections/items/records/${id}`, owner.t)
		assert.equal(v.json.trusteesOnly, true, `item ${id} flipped to private`)
		assert.deepEqual(v.json.groups, [], `item ${id} group ref removed`)
	}
})
