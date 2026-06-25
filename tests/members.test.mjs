// Member management end-to-end: directly adding/removing members and the
// authorization boundaries enforced by the group_members collection rules.
// (The "add by username" lookup itself is frontend logic, tested in the
// SvelteKit Vitest suite; here we verify the data-layer effect + the rules.)
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { startPB, stopPB, makeUser, api } from './harness.mjs'

let pb, owner, alice, bob

before(async () => {
	pb = await startPB()
	owner = await makeUser('owner')
	alice = await makeUser('alice')
	bob = await makeUser('bob')
})

after(() => stopPB(pb))

// Owner creates a group + a trustees-only item shared with it. Returns ids.
async function groupWithItem(name) {
	const g = await api('POST', '/api/collections/groups/records', owner.t, { name, owner: owner.id })
	assert.equal(g.status, 200, 'group create')
	const it = await api('POST', '/api/collections/items/records', owner.t, {
		name: 'Leiter',
		description: '3m',
		place: 'Schuppen',
		owner: owner.id,
		trusteesOnly: true,
		groups: [g.json.id],
		status: 'available',
	})
	assert.equal(it.status, 200, 'item create')
	return { groupId: g.json.id, itemId: it.json.id }
}

test('the owner can add a member directly, and that member gains access', async () => {
	const { groupId, itemId } = await groupWithItem('DirectAdd')

	// before: alice cannot see the item
	assert.equal((await api('GET', `/api/collections/items/records/${itemId}`, alice.t)).status, 404)

	// owner adds alice as a member
	const add = await api('POST', '/api/collections/group_members/records', owner.t, {
		group: groupId,
		user: alice.id,
	})
	assert.equal(add.status, 200, 'owner can add a member')

	// after: alice can see the item
	assert.equal((await api('GET', `/api/collections/items/records/${itemId}`, alice.t)).status, 200)
})

test('a non-owner cannot add members to a group they do not own', async () => {
	const { groupId } = await groupWithItem('NoSneaking')

	// bob (not the owner) tries to add himself
	const sneaky = await api('POST', '/api/collections/group_members/records', bob.t, {
		group: groupId,
		user: bob.id,
	})
	assert.notEqual(sneaky.status, 200, 'non-owner must not be able to add members')

	// and bob indeed has no membership row
	const rows = await api(
		'GET',
		`/api/collections/group_members/records?filter=${encodeURIComponent(`group="${groupId}" && user="${bob.id}"`)}`,
		owner.t
	)
	assert.equal(rows.json.totalItems, 0)
})

test('the owner can remove a member, who then loses access', async () => {
	const { groupId, itemId } = await groupWithItem('RemoveMember')
	const add = await api('POST', '/api/collections/group_members/records', owner.t, { group: groupId, user: alice.id })
	assert.equal((await api('GET', `/api/collections/items/records/${itemId}`, alice.t)).status, 200)

	// owner removes alice
	const del = await api('DELETE', `/api/collections/group_members/records/${add.json.id}`, owner.t)
	assert.ok([200, 204].includes(del.status), 'owner can remove a member')

	assert.equal((await api('GET', `/api/collections/items/records/${itemId}`, alice.t)).status, 404)
})

test('a member can leave (delete their own membership) but cannot remove another member', async () => {
	const { groupId, itemId } = await groupWithItem('LeaveVsRemove')
	const aliceM = await api('POST', '/api/collections/group_members/records', owner.t, { group: groupId, user: alice.id })
	const bobM = await api('POST', '/api/collections/group_members/records', owner.t, { group: groupId, user: bob.id })

	// alice cannot remove bob's membership (she is neither owner nor that user)
	const forbidden = await api('DELETE', `/api/collections/group_members/records/${bobM.json.id}`, alice.t)
	assert.notEqual(forbidden.status, 200)
	assert.notEqual(forbidden.status, 204)
	assert.equal((await api('GET', `/api/collections/items/records/${itemId}`, bob.t)).status, 200, 'bob still a member')

	// alice CAN leave by deleting her own membership
	const leave = await api('DELETE', `/api/collections/group_members/records/${aliceM.json.id}`, alice.t)
	assert.ok([200, 204].includes(leave.status), 'a member can leave')
	assert.equal((await api('GET', `/api/collections/items/records/${itemId}`, alice.t)).status, 404, 'alice lost access')
})

test('every member sees the full roster, and the owner is an admin member', async () => {
	const { groupId } = await groupWithItem('MemberList')
	await api('POST', '/api/collections/group_members/records', owner.t, { group: groupId, user: alice.id })
	await api('POST', '/api/collections/group_members/records', owner.t, { group: groupId, user: bob.id })

	// owner (admin member) + alice + bob = 3 rows
	const ownerView = await api('GET', `/api/collections/group_members/records?filter=${encodeURIComponent(`group="${groupId}"`)}`, owner.t)
	assert.equal(ownerView.json.totalItems, 3, 'owner sees the full roster')
	const ownerRow = ownerView.json.items.find((r) => r.user === owner.id)
	assert.equal(ownerRow?.role, 'admin', 'the owner is stored as an admin member')
	// the directly-added members are plain `member`s, not admins
	assert.equal(ownerView.json.items.find((r) => r.user === alice.id)?.role, 'member', 'alice is a member')
	assert.equal(ownerView.json.items.find((r) => r.user === bob.id)?.role, 'member', 'bob is a member')

	// a regular member now ALSO sees the full roster (was: only their own row)
	const aliceView = await api('GET', `/api/collections/group_members/records?filter=${encodeURIComponent(`group="${groupId}"`)}`, alice.t)
	assert.equal(aliceView.json.totalItems, 3, 'a member sees the full roster too')
})

test('the owner cannot remove their own admin membership (must delete the group)', async () => {
	const { groupId } = await groupWithItem('OwnerLeave')
	const rows = await api('GET', `/api/collections/group_members/records?filter=${encodeURIComponent(`group="${groupId}" && user="${owner.id}"`)}`, owner.t)
	assert.equal(rows.json.totalItems, 1, 'owner has an admin membership row')
	const del = await api('DELETE', `/api/collections/group_members/records/${rows.json.items[0].id}`, owner.t)
	assert.notEqual(del.status, 204, 'owner admin row is not deletable via leave')
	assert.notEqual(del.status, 200)
})
