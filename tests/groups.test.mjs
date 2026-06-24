// Visibility + lifecycle of the groups feature, end-to-end against PocketBase.
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { startPB, stopPB, makeUser, api } from './harness.mjs'

let pb, owner, member, stranger

before(async () => {
	pb = await startPB()
	owner = await makeUser('owner')
	member = await makeUser('member')
	stranger = await makeUser('stranger') // neither trusted nor a group member
})

after(() => stopPB(pb))

// Helper: owner creates a group + a trustees-only item shared with it.
async function makeGroupWithItem() {
	const g = await api('POST', '/api/collections/groups/records', owner.t, {
		name: 'Nachbarschaft',
		owner: owner.id,
	})
	assert.equal(g.status, 200, 'group create')
	const it = await api('POST', '/api/collections/items/records', owner.t, {
		name: 'Bohrmaschine',
		description: 'Akku',
		place: 'Keller',
		owner: owner.id,
		trusteesOnly: true,
		groups: [g.json.id],
		status: 'available',
	})
	assert.equal(it.status, 200, 'item create')
	return { groupId: g.json.id, itemId: it.json.id }
}

test('a trustees item is hidden from non-members and visible to the owner', async () => {
	const { itemId } = await makeGroupWithItem()
	assert.equal((await api('GET', `/api/collections/items/records/${itemId}`, member.t)).status, 404)
	assert.equal((await api('GET', `/api/collections/items/records/${itemId}`, stranger.t)).status, 404)
	assert.equal((await api('GET', `/api/collections/items/records/${itemId}`, owner.t)).status, 200)
})

test('joining via an invite grants visibility; non-members stay blocked', async () => {
	const { groupId, itemId } = await makeGroupWithItem()
	const inv = await api('POST', '/api/collections/group_invites/records', owner.t, { group: groupId })
	assert.equal(inv.status, 200)

	// preview resolves the token to the group
	const preview = await api('GET', `/api/group-invite/${inv.json.token}`)
	assert.equal(preview.status, 200)
	assert.equal(preview.json.group.name, 'Nachbarschaft')

	// member joins, then sees the item
	const join = await api('POST', `/api/group-invite/${inv.json.token}/join`, member.t)
	assert.equal(join.status, 200)
	assert.equal(join.json.joined, true)
	assert.equal((await api('GET', `/api/collections/items/records/${itemId}`, member.t)).status, 200)

	// stranger still cannot
	assert.equal((await api('GET', `/api/collections/items/records/${itemId}`, stranger.t)).status, 404)
})

test('search view includes group items for members, excludes them for others', async () => {
	const { groupId, itemId } = await makeGroupWithItem()
	const inv = await api('POST', '/api/collections/group_invites/records', owner.t, { group: groupId })
	await api('POST', `/api/group-invite/${inv.json.token}/join`, member.t)

	const find = async (tok) => {
		const r = await api('GET', `/api/collections/items_searchable/records?filter=${encodeURIComponent(`id="${itemId}"`)}`, tok)
		return r.json.totalItems
	}
	assert.equal(await find(member.t), 1, 'member finds it in search')
	assert.equal(await find(owner.t), 1, 'owner finds it in search')
	assert.equal(await find(stranger.t), 0, 'stranger does not')
})

test('the search view does not leak the groups column', async () => {
	const { itemId } = await makeGroupWithItem()
	// Owner reads via the search view with the same field allowlist the app uses.
	const fields =
		'id,name,image,externalImgUrl,externalUrl,description,trusteesOnly,status,collectionId,categories,updated,userId,username,isInstitution,bio,verified,profileImage,userCreated,ownerHasLocation'
	const r = await api(
		'GET',
		`/api/collections/items_searchable/records?filter=${encodeURIComponent(`id="${itemId}"`)}&fields=${encodeURIComponent(fields)}`,
		owner.t
	)
	assert.equal(r.status, 200)
	assert.ok(!('groups' in (r.json.items[0] ?? {})), 'groups must not be returned')
})

test('deleting a group revokes access and falls back to private (never public)', async () => {
	const { groupId, itemId } = await makeGroupWithItem()
	const inv = await api('POST', '/api/collections/group_invites/records', owner.t, { group: groupId })
	await api('POST', `/api/group-invite/${inv.json.token}/join`, member.t)
	assert.equal((await api('GET', `/api/collections/items/records/${itemId}`, member.t)).status, 200)

	// owner deletes the group
	assert.ok([200, 204].includes((await api('DELETE', `/api/collections/groups/records/${groupId}`, owner.t)).status))

	// member loses access; owner keeps the item with the group ref dropped (still trustees-only -> private)
	assert.equal((await api('GET', `/api/collections/items/records/${itemId}`, member.t)).status, 404)
	const ownerView = await api('GET', `/api/collections/items/records/${itemId}`, owner.t)
	assert.equal(ownerView.status, 200)
	assert.deepEqual(ownerView.json.groups, [])
})

test('only the owner can create/list a group\'s invites and members', async () => {
	const g = await api('POST', '/api/collections/groups/records', owner.t, { name: 'Privat', owner: owner.id })
	// a non-owner cannot create an invite for someone else's group
	const sneaky = await api('POST', '/api/collections/group_invites/records', stranger.t, { group: g.json.id })
	assert.notEqual(sneaky.status, 200, 'non-owner must not create invites')
	// a non-owner cannot list the group's invites
	const list = await api('GET', `/api/collections/group_invites/records?filter=${encodeURIComponent(`group="${g.json.id}"`)}`, stranger.t)
	assert.equal(list.json.totalItems ?? 0, 0, 'non-owner cannot enumerate invites')
})

test('a user can only create a group owned by themselves', async () => {
	// forging ownership is rejected (createRule: @request.auth.id = owner)
	const forged = await api('POST', '/api/collections/groups/records', stranger.t, {
		name: 'Forged',
		owner: owner.id,
	})
	assert.notEqual(forged.status, 200, 'cannot create a group owned by someone else')

	// creating your own group works
	const own = await api('POST', '/api/collections/groups/records', stranger.t, {
		name: 'Mine',
		owner: stranger.id,
	})
	assert.equal(own.status, 200)
})

test('only the owner can rename / update a group', async () => {
	const g = await api('POST', '/api/collections/groups/records', owner.t, { name: 'Before', owner: owner.id })

	const byStranger = await api('PATCH', `/api/collections/groups/records/${g.json.id}`, stranger.t, {
		name: 'Hacked',
	})
	assert.notEqual(byStranger.status, 200, 'non-owner cannot update the group')

	const byOwner = await api('PATCH', `/api/collections/groups/records/${g.json.id}`, owner.t, { name: 'After' })
	assert.equal(byOwner.status, 200)
	assert.equal(byOwner.json.name, 'After')
})
