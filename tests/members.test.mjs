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

test('the owner sees the full member list; a member sees only their own row', async () => {
	const { groupId } = await groupWithItem('MemberList')
	await api('POST', '/api/collections/group_members/records', owner.t, { group: groupId, user: alice.id })
	await api('POST', '/api/collections/group_members/records', owner.t, { group: groupId, user: bob.id })

	const ownerView = await api('GET', `/api/collections/group_members/records?filter=${encodeURIComponent(`group="${groupId}"`)}`, owner.t)
	assert.equal(ownerView.json.totalItems, 2, 'owner sees all members')

	const aliceView = await api('GET', `/api/collections/group_members/records?filter=${encodeURIComponent(`group="${groupId}"`)}`, alice.t)
	assert.equal(aliceView.json.totalItems, 1, 'member sees only their own membership row')
})
