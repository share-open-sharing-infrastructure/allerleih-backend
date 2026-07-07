// Digest visibility — verifies the access-rule semantics that the weekly digest
// cron must replicate. The digest runs as superuser and enforces visibility in
// application code, so these tests document the correct rules:
//
//  - trusteesOnly items: visible only when the OWNER trusts the viewer
//    (NOT when the viewer trusts the owner — that was the privacy bug in #21)
//  - group-only items: visible only to group members
//  - public items: visible to any authenticated user
//  - trust direction is one-way: A trusts B ≠ B trusts A
//
// The cron cannot be triggered via API, so we test the same semantics through
// the collection rules (which are the source of truth the digest must mirror).
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { startPB, stopPB, makeUser, api, adminAuth } from './harness.mjs'

let pb, alice, bob, carol

before(async () => {
	pb = await startPB()
	alice = await makeUser('dalice')   // item owner
	bob = await makeUser('dbob')       // will trust alice (but alice may not trust bob)
	carol = await makeUser('dcarol')   // outsider / group member in some tests
})

after(() => stopPB(pb))

const getItem = (id, tok) => api('GET', `/api/collections/items/records/${id}`, tok)

async function createItem(owner, extra) {
	const it = await api('POST', '/api/collections/items/records', owner.t, {
		name: 'DigestTestItem',
		description: 'test',
		place: 'somewhere',
		owner: owner.id,
		status: 'available',
		...extra,
	})
	assert.equal(it.status, 200, 'item creation should succeed')
	return it.json.id
}

// --- Trust direction tests (the privacy bug in #21) ---

test('trusteesOnly: viewer trusting owner is NOT enough — owner must trust viewer', async () => {
	// Bob trusts Alice, but Alice does NOT trust Bob
	await api('PATCH', `/api/collections/users/records/${bob.id}`, bob.t, { trusts: [alice.id] })
	await api('PATCH', `/api/collections/users/records/${alice.id}`, alice.t, { trusts: [] })

	const itemId = await createItem(alice, { trusteesOnly: true })

	// Bob should NOT see it — Alice hasn't trusted Bob
	const res = await getItem(itemId, bob.t)
	assert.equal(res.status, 404, 'bob trusts alice but alice does not trust bob → blocked')

	// Cleanup
	await api('PATCH', `/api/collections/users/records/${bob.id}`, bob.t, { trusts: [] })
})

test('trusteesOnly: owner trusting viewer DOES grant access', async () => {
	// Alice trusts Bob
	await api('PATCH', `/api/collections/users/records/${alice.id}`, alice.t, { trusts: [bob.id] })

	const itemId = await createItem(alice, { trusteesOnly: true })

	const res = await getItem(itemId, bob.t)
	assert.equal(res.status, 200, 'alice trusts bob → bob sees trusteesOnly item')

	// Cleanup
	await api('PATCH', `/api/collections/users/records/${alice.id}`, alice.t, { trusts: [] })
})

test('trusteesOnly: trust is one-way — mutual trust not required', async () => {
	// Alice trusts Bob, Bob does NOT trust Alice
	await api('PATCH', `/api/collections/users/records/${alice.id}`, alice.t, { trusts: [bob.id] })
	await api('PATCH', `/api/collections/users/records/${bob.id}`, bob.t, { trusts: [] })

	const itemId = await createItem(alice, { trusteesOnly: true })

	// Bob CAN see it (owner trusts viewer)
	assert.equal((await getItem(itemId, bob.t)).status, 200, 'bob sees it — alice trusts him')
	// Carol cannot
	assert.equal((await getItem(itemId, carol.t)).status, 404, 'carol is not trusted by alice → blocked')

	// Cleanup
	await api('PATCH', `/api/collections/users/records/${alice.id}`, alice.t, { trusts: [] })
})

// --- Group-only visibility (the second leak vector in #21) ---

test('group-only item: trusting the owner does NOT bypass group membership', async () => {
	// Create a group with carol as a member; bob is NOT a member
	const g = await api('POST', '/api/collections/groups/records', alice.t, { name: 'DigestGroup', owner: alice.id })
	assert.equal(g.status, 200)
	const groupId = g.json.id
	await api('POST', '/api/collections/group_members/records', alice.t, { group: groupId, user: carol.id })

	// Bob trusts Alice (but is NOT in the group)
	await api('PATCH', `/api/collections/users/records/${bob.id}`, bob.t, { trusts: [alice.id] })

	// group-only item (trusteesOnly=false, groups=[...])
	const itemId = await createItem(alice, { trusteesOnly: false, groups: [groupId] })

	// Carol (group member) can see it
	assert.equal((await getItem(itemId, carol.t)).status, 200, 'carol is group member → sees it')
	// Bob (trusts owner, but not in group) should NOT see it
	assert.equal((await getItem(itemId, bob.t)).status, 404, 'bob trusts alice but is not in group → blocked')

	// Cleanup
	await api('PATCH', `/api/collections/users/records/${bob.id}`, bob.t, { trusts: [] })
})

test('trusteesOnly + group: item visible via group membership even without trust', async () => {
	// Alice does NOT trust Carol, but Carol IS in the group
	const g = await api('POST', '/api/collections/groups/records', alice.t, { name: 'DigestGroup2', owner: alice.id })
	assert.equal(g.status, 200)
	const groupId = g.json.id
	await api('POST', '/api/collections/group_members/records', alice.t, { group: groupId, user: carol.id })
	await api('PATCH', `/api/collections/users/records/${alice.id}`, alice.t, { trusts: [] })

	const itemId = await createItem(alice, { trusteesOnly: true, groups: [groupId] })

	// Carol sees it via group membership (even though alice doesn't trust carol)
	assert.equal((await getItem(itemId, carol.t)).status, 200, 'carol sees via group membership')
	// Bob has neither trust nor group membership
	assert.equal((await getItem(itemId, bob.t)).status, 404, 'bob has no access path → blocked')
})

// --- Public items ---

test('public item (trusteesOnly=false, no groups) is visible to anyone authenticated', async () => {
	const itemId = await createItem(alice, { trusteesOnly: false })

	assert.equal((await getItem(itemId, bob.t)).status, 200, 'bob sees public item')
	assert.equal((await getItem(itemId, carol.t)).status, 200, 'carol sees public item')
})

test('public item is NOT visible without authentication', async () => {
	const itemId = await createItem(alice, { trusteesOnly: false })

	// Anonymous request (no token) — PocketBase returns 404 (hides existence)
	assert.equal((await getItem(itemId, null)).status, 404, 'anonymous user blocked by items collection')
})
