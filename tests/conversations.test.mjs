// Conversations vs. the group visibility model:
//  - a conversation participant keeps access to the requested item even after
//    losing group membership (otherwise the conversation list/detail break)
//  - the conversations createRule matches the independent visibility model
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { startPB, stopPB, makeUser, api } from './harness.mjs'

let pb, owner, member, outsider

before(async () => {
	pb = await startPB()
	owner = await makeUser('cowner')
	member = await makeUser('cmember')
	outsider = await makeUser('coutsider')
})

after(() => stopPB(pb))

async function groupWithMember(name, userId) {
	const g = await api('POST', '/api/collections/groups/records', owner.t, { name, owner: owner.id })
	await api('POST', '/api/collections/group_members/records', owner.t, { group: g.json.id, user: userId })
	return g.json.id
}
async function groupItem(groupId) {
	const it = await api('POST', '/api/collections/items/records', owner.t, {
		name: 'Borrowable',
		description: 'd',
		place: 'p',
		owner: owner.id,
		trusteesOnly: false, // GROUP-ONLY (not public, not trustees)
		groups: [groupId],
		status: 'available',
	})
	assert.equal(it.status, 200)
	return it.json.id
}

test('createRule: a group member can request a group item, a non-member cannot', async () => {
	const g = await groupWithMember('ReqGroup', member.id)
	const itemId = await groupItem(g)

	const ok = await api('POST', '/api/collections/conversations/records', member.t, {
		requester: member.id,
		itemOwner: owner.id,
		requestedItem: itemId,
	})
	assert.equal(ok.status, 200, 'group member can start a conversation')

	// outsider is not a member and the item is NOT public (group-only) -> blocked
	const bad = await api('POST', '/api/collections/conversations/records', outsider.t, {
		requester: outsider.id,
		itemOwner: owner.id,
		requestedItem: itemId,
	})
	assert.notEqual(bad.status, 200, 'non-member cannot start a conversation for a group-only item')
})

test('a conversation participant keeps item access after being removed from the group', async () => {
	const g = await groupWithMember('BorrowGroup', member.id)
	const itemId = await groupItem(g)

	// sanity: member sees the item via the group
	assert.equal((await api('GET', `/api/collections/items/records/${itemId}`, member.t)).status, 200)

	// member borrows it (creates the conversation)
	const conv = await api('POST', '/api/collections/conversations/records', member.t, {
		requester: member.id,
		itemOwner: owner.id,
		requestedItem: itemId,
	})
	assert.equal(conv.status, 200)

	// owner removes the member from the group
	const m = await api('GET', `/api/collections/group_members/records?filter=${encodeURIComponent(`group="${g}" && user="${member.id}"`)}`, owner.t)
	await api('DELETE', `/api/collections/group_members/records/${m.json.items[0].id}`, owner.t)

	// group access is gone, BUT as the conversation's requester the member must
	// still be able to view the item (so the conversation keeps working).
	assert.equal((await api('GET', `/api/collections/items/records/${itemId}`, member.t)).status, 200, 'item still visible via conversation')

	// and expanding requestedItem on the conversation still resolves
	const c = await api('GET', `/api/collections/conversations/records/${conv.json.id}?expand=requestedItem`, member.t)
	assert.equal(c.status, 200)
	assert.equal(c.json.expand?.requestedItem?.id, itemId, 'requestedItem still expands for the participant')

	// an unrelated outsider still cannot see the item
	assert.equal((await api('GET', `/api/collections/items/records/${itemId}`, outsider.t)).status, 404)

	// IMPORTANT: conversation access is scoped to the conversation only — the item
	// must NOT resurface in browse/search (items_searchable carries no conversation
	// clause), so it won't pollute the owner's profile for the removed member.
	const inSearch = await api('GET', `/api/collections/items_searchable/records?filter=${encodeURIComponent(`id="${itemId}"`)}`, member.t)
	assert.equal(inSearch.json.totalItems, 0, 'conversation item stays out of search/profile')
})
