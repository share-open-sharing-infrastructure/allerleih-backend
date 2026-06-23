// How group visibility composes with the existing trust system, plus public
// items, multi-group sharing, and who can read a group record itself.
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { startPB, stopPB, makeUser, api } from './harness.mjs'

let pb, owner, groupMember, trustedUser, memberA, memberB, outsider

before(async () => {
	pb = await startPB()
	owner = await makeUser('owner')
	groupMember = await makeUser('groupmember')
	trustedUser = await makeUser('trusteduser')
	memberA = await makeUser('membera')
	memberB = await makeUser('memberb')
	outsider = await makeUser('outsider')
})

after(() => stopPB(pb))

const get = (itemId, tok) => api('GET', `/api/collections/items/records/${itemId}`, tok)

async function createGroup(name) {
	const g = await api('POST', '/api/collections/groups/records', owner.t, { name, owner: owner.id })
	assert.equal(g.status, 200)
	return g.json.id
}
async function addMember(groupId, userId) {
	const r = await api('POST', '/api/collections/group_members/records', owner.t, { group: groupId, user: userId })
	assert.equal(r.status, 200)
}
async function createItem(extra) {
	const it = await api('POST', '/api/collections/items/records', owner.t, {
		name: 'Item',
		description: 'x',
		place: 'p',
		owner: owner.id,
		status: 'available',
		...extra,
	})
	assert.equal(it.status, 200)
	return it.json.id
}

test('group access and trust access grant visibility independently (the union)', async () => {
	const g = await createGroup('Union')
	await addMember(g, groupMember.id)
	// owner trusts trustedUser (who is NOT a group member)
	const upd = await api('PATCH', `/api/collections/users/records/${owner.id}`, owner.t, {
		trusts: [trustedUser.id],
	})
	assert.equal(upd.status, 200)

	const itemId = await createItem({ trusteesOnly: true, groups: [g] })

	assert.equal((await get(itemId, groupMember.t)).status, 200, 'group member sees it')
	assert.equal((await get(itemId, trustedUser.t)).status, 200, 'trusted (non-member) sees it')
	assert.equal((await get(itemId, outsider.t)).status, 404, 'neither -> blocked')

	// reset trust so it can't leak into other tests in this file
	await api('PATCH', `/api/collections/users/records/${owner.id}`, owner.t, { trusts: [] })
})

test('a non-trustees item is public (visible to anyone logged in), groups irrelevant', async () => {
	const itemId = await createItem({ trusteesOnly: false })
	assert.equal((await get(itemId, outsider.t)).status, 200)
})

test('an item shared with multiple groups is visible to members of any of them', async () => {
	const g1 = await createGroup('Multi-1')
	const g2 = await createGroup('Multi-2')
	await addMember(g1, memberA.id)
	await addMember(g2, memberB.id)

	const itemId = await createItem({ trusteesOnly: true, groups: [g1, g2] })

	assert.equal((await get(itemId, memberA.t)).status, 200, 'member of group 1 sees it')
	assert.equal((await get(itemId, memberB.t)).status, 200, 'member of group 2 sees it')
	assert.equal((await get(itemId, outsider.t)).status, 404, 'member of neither does not')
})

test('a GROUP-ONLY item (trusteesOnly=false + groups) excludes the trust list', async () => {
	const g = await createGroup('GroupOnly')
	await addMember(g, groupMember.id)
	// owner trusts trustedUser, who is NOT in the group
	await api('PATCH', `/api/collections/users/records/${owner.id}`, owner.t, { trusts: [trustedUser.id] })

	// trusteesOnly is OFF, but the item is shared with a group -> NOT public,
	// and the trust list must NOT grant access (the whole point of the new model).
	const itemId = await createItem({ trusteesOnly: false, groups: [g] })

	assert.equal((await get(itemId, groupMember.t)).status, 200, 'group member sees it')
	assert.equal((await get(itemId, trustedUser.t)).status, 404, 'trusted (non-member) does NOT see it')
	assert.equal((await get(itemId, outsider.t)).status, 404, 'outsider does not')
	assert.equal((await get(itemId, owner.t)).status, 200, 'owner sees it')

	await api('PATCH', `/api/collections/users/records/${owner.id}`, owner.t, { trusts: [] })
})

test('a group-only item is not public and is masked in items_public', async () => {
	const g = await createGroup('GroupOnlyMask')
	await addMember(g, groupMember.id)
	const itemId = await createItem({ trusteesOnly: false, groups: [g], name: 'SecretDrill', description: 'hush' })

	// base items: outsider blocked entirely
	assert.equal((await get(itemId, outsider.t)).status, 404, 'not public on base items')

	// items_public is world-readable but must MASK a group-shared item's content
	const pub = await api('GET', `/api/collections/items_public/records/${itemId}`)
	assert.equal(pub.status, 200, 'items_public row exists (metadata only)')
	assert.equal(pub.json.name, null, 'name masked')
	assert.equal(pub.json.description, null, 'description masked')
})

test('a TRUSTEES-ONLY item (no groups) is hidden from non-trusted group members', async () => {
	const g = await createGroup('TrustOnly')
	await addMember(g, groupMember.id) // group member, but owner does NOT trust them
	await api('PATCH', `/api/collections/users/records/${owner.id}`, owner.t, { trusts: [trustedUser.id] })

	const itemId = await createItem({ trusteesOnly: true }) // no groups

	assert.equal((await get(itemId, trustedUser.t)).status, 200, 'trusted user sees it')
	assert.equal((await get(itemId, groupMember.t)).status, 404, 'unrelated group member does not')
	assert.equal((await get(itemId, outsider.t)).status, 404, 'outsider does not')

	await api('PATCH', `/api/collections/users/records/${owner.id}`, owner.t, { trusts: [] })
})

test('deleting a group-only item\'s last group makes it PRIVATE, never public', async () => {
	const g = await createGroup('SoleGroup')
	await addMember(g, groupMember.id)
	// group-only: trusteesOnly off, shared only with this one group
	const itemId = await createItem({ trusteesOnly: false, groups: [g] })
	assert.equal((await get(itemId, outsider.t)).status, 404, 'not public while grouped')

	// delete the only group -> ref is cascade-removed; the onRecordDelete hook must
	// flip the item to trustees-only so it does NOT fall back to public.
	assert.ok([200, 204].includes((await api('DELETE', `/api/collections/groups/records/${g}`, owner.t)).status))

	assert.equal((await get(itemId, outsider.t)).status, 404, 'MUST NOT become public after group delete')
	const ownerView = await get(itemId, owner.t)
	assert.equal(ownerView.status, 200, 'owner still sees it')
	assert.equal(ownerView.json.trusteesOnly, true, 'flipped to trustees-only (private)')
	assert.deepEqual(ownerView.json.groups, [], 'group ref removed')
})

test('owner and members can read the group record; non-members cannot', async () => {
	const g = await createGroup('GroupRecord')
	await addMember(g, groupMember.id)

	assert.equal((await api('GET', `/api/collections/groups/records/${g}`, owner.t)).status, 200, 'owner reads it')
	assert.equal((await api('GET', `/api/collections/groups/records/${g}`, groupMember.t)).status, 200, 'member reads it')
	assert.equal((await api('GET', `/api/collections/groups/records/${g}`, outsider.t)).status, 404, 'non-member cannot')
})
