// Conversations vs. the group visibility model:
//  - a conversation participant keeps access to the requested item even after
//    losing group membership (otherwise the conversation list/detail break)
//  - the conversations createRule matches the independent visibility model
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { startPB, stopPB, makeUser, api } from './harness.mjs'

let pb, owner, member, outsider, trustedUser, borrower

before(async () => {
	pb = await startPB()
	owner = await makeUser('cowner')
	member = await makeUser('cmember')
	outsider = await makeUser('coutsider')
	trustedUser = await makeUser('ctrusted')
	borrower = await makeUser('cborrower')
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

async function trusteesOnlyItem() {
	const it = await api('POST', '/api/collections/items/records', owner.t, {
		name: 'TrustBorrowable',
		description: 'd',
		place: 'p',
		owner: owner.id,
		trusteesOnly: true, // TRUSTEES-ONLY (not public, not group)
		status: 'available',
	})
	assert.equal(it.status, 200)
	return it.json.id
}

// Exercises the trust clause of the conversations createRule specifically — the
// deepest migrated back-relation traversal (requestedItem -> owner ->
// trusts_via_truster -> trustee), which only fails at runtime.
test('createRule: a trusted user can request a trustees-only item, a non-trusted user cannot', async () => {
	// owner trusts trustedUser: a trusts edge {truster: owner, trustee: trustedUser}
	const edge = await api('POST', '/api/collections/trusts/records', owner.t, {
		truster: owner.id,
		trustee: trustedUser.id,
	})
	assert.equal(edge.status, 200)

	const itemId = await trusteesOnlyItem()

	const ok = await api('POST', '/api/collections/conversations/records', trustedUser.t, {
		requester: trustedUser.id,
		itemOwner: owner.id,
		requestedItem: itemId,
	})
	assert.equal(ok.status, 200, 'trusted user can start a conversation for a trustees-only item')

	const bad = await api('POST', '/api/collections/conversations/records', outsider.t, {
		requester: outsider.id,
		itemOwner: owner.id,
		requestedItem: itemId,
	})
	assert.notEqual(bad.status, 200, 'non-trusted user cannot request a trustees-only item')
})

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

// --- Request abort (#373): lending.pb.js onRecordUpdateRequest guard ---------

// A public item (not trustees-only, no groups) so any user can request it.
async function publicItem() {
	const it = await api('POST', '/api/collections/items/records', owner.t, {
		name: 'AbortBorrowable',
		description: 'd',
		place: 'p',
		owner: owner.id,
		trusteesOnly: false,
		status: 'available',
	})
	assert.equal(it.status, 200)
	return it.json.id
}

// Start a pending conversation as `user` for `itemId`.
async function pendingConversation(user, itemId) {
	const conv = await api('POST', '/api/collections/conversations/records', user.t, {
		requester: user.id,
		itemOwner: owner.id,
		requestedItem: itemId,
		lendingStatus: 'pending',
	})
	assert.equal(conv.status, 200, 'conversation created')
	return conv.json.id
}

// Drive a conversation to `accepted`, mirroring acceptRequest: the owner flips
// the conversation to accepted and marks the item unavailable.
async function acceptConversation(convId, itemId) {
	const c = await api('PATCH', `/api/collections/conversations/records/${convId}`, owner.t, {
		lendingStatus: 'accepted',
	})
	assert.equal(c.status, 200, 'owner accepted')
	const it = await api('PATCH', `/api/collections/items/records/${itemId}`, owner.t, {
		status: 'unavailable',
	})
	assert.equal(it.status, 200, 'item marked unavailable on accept')
}

async function itemStatus(itemId) {
	const it = await api('GET', `/api/collections/items/records/${itemId}`, owner.t)
	return it.json.status
}

test('abort: requester aborts a pending request (200; item stays available)', async () => {
	const itemId = await publicItem()
	const convId = await pendingConversation(borrower, itemId)

	const res = await api('PATCH', `/api/collections/conversations/records/${convId}`, borrower.t, {
		lendingStatus: 'aborted',
	})
	assert.equal(res.status, 200, 'requester may abort from pending')
	assert.equal(res.json.lendingStatus, 'aborted')
	assert.equal(await itemStatus(itemId), 'available', 'pending item was never reserved')
})

test('abort: owner aborts a pending request (200)', async () => {
	const itemId = await publicItem()
	const convId = await pendingConversation(borrower, itemId)

	const res = await api('PATCH', `/api/collections/conversations/records/${convId}`, owner.t, {
		lendingStatus: 'aborted',
	})
	assert.equal(res.status, 200, 'owner may abort from pending')
	assert.equal(res.json.lendingStatus, 'aborted')
})

test('abort: requester aborts an accepted request → item reset to available', async () => {
	const itemId = await publicItem()
	const convId = await pendingConversation(borrower, itemId)
	await acceptConversation(convId, itemId)
	assert.equal(await itemStatus(itemId), 'unavailable', 'accept reserved the item')

	// The non-owner requester aborts — the elevated hook frees the item even
	// though the requester cannot update the owner's item directly.
	const res = await api('PATCH', `/api/collections/conversations/records/${convId}`, borrower.t, {
		lendingStatus: 'aborted',
	})
	assert.equal(res.status, 200, 'requester may abort from accepted')
	assert.equal(res.json.lendingStatus, 'aborted')
	assert.equal(await itemStatus(itemId), 'available', 'item freed on accepted → aborted')
})

test('abort: owner aborts an accepted request → item reset to available', async () => {
	const itemId = await publicItem()
	const convId = await pendingConversation(borrower, itemId)
	await acceptConversation(convId, itemId)

	const res = await api('PATCH', `/api/collections/conversations/records/${convId}`, owner.t, {
		lendingStatus: 'aborted',
	})
	assert.equal(res.status, 200, 'owner may abort from accepted')
	assert.equal(await itemStatus(itemId), 'available', 'item freed on accepted → aborted')
})

test('abort: forbidden from active / return_requested / completed / rejected', async () => {
	for (const state of ['active', 'return_requested', 'completed', 'rejected']) {
		const itemId = await publicItem()
		const convId = await pendingConversation(borrower, itemId)
		const set = await api('PATCH', `/api/collections/conversations/records/${convId}`, owner.t, {
			lendingStatus: state,
		})
		assert.equal(set.status, 200, `setup: reach ${state}`)

		const res = await api('PATCH', `/api/collections/conversations/records/${convId}`, borrower.t, {
			lendingStatus: 'aborted',
		})
		assert.notEqual(res.status, 200, `abort must be rejected from ${state}`)
	}
})

test('abort: an already-aborted conversation still accepts routine updates (no persistent 400)', async () => {
	const itemId = await publicItem()
	const convId = await pendingConversation(borrower, itemId)

	const aborted = await api('PATCH', `/api/collections/conversations/records/${convId}`, borrower.t, {
		lendingStatus: 'aborted',
	})
	assert.equal(aborted.status, 200, 'abort succeeds')

	// A benign follow-up update (the client's periodic "mark seen" ping) must NOT
	// be re-validated by the abort guard — lendingStatus stays 'aborted' but this
	// is not a transition into aborted, so it must pass through.
	const seen = await api('PATCH', `/api/collections/conversations/records/${convId}`, borrower.t, {
		requesterLastSeenAt: new Date().toISOString(),
	})
	assert.equal(seen.status, 200, 'routine update on an aborted conversation must succeed')

	const read = await api('PATCH', `/api/collections/conversations/records/${convId}`, owner.t, {
		readByOwner: true,
	})
	assert.equal(read.status, 200, 'read-flag update on an aborted conversation must succeed')
})

test('abort: cannot repoint requestedItem at a victim item (no item hijack)', async () => {
	// The attacker's own legit accepted conversation.
	const ownItemId = await publicItem()
	const convId = await pendingConversation(borrower, ownItemId)
	await acceptConversation(convId, ownItemId)

	// A victim item the attacker has no right to touch, currently reserved.
	const victim = await api('POST', '/api/collections/items/records', owner.t, {
		name: 'VictimReserved',
		description: 'd',
		place: 'p',
		owner: owner.id,
		trusteesOnly: false,
		status: 'unavailable',
	})
	assert.equal(victim.status, 200)
	const victimId = victim.json.id

	// Attacker aborts their own conversation but tries to repoint requestedItem at
	// the victim item — the elevated item reset must never reach the victim.
	const res = await api('PATCH', `/api/collections/conversations/records/${convId}`, borrower.t, {
		lendingStatus: 'aborted',
		requestedItem: victimId,
	})
	assert.notEqual(res.status, 200, 'repointing requestedItem during abort is rejected')

	// The victim item is untouched (still reserved) and the conversation still
	// points at the attacker's own item.
	assert.equal(await itemStatus(victimId), 'unavailable', 'victim item status must be unchanged')
	const conv = await api('GET', `/api/collections/conversations/records/${convId}`, borrower.t)
	assert.equal(conv.json.requestedItem, ownItemId, 'requestedItem relation must not be repointed')
})

test('abort: a non-participant cannot abort (403)', async () => {
	const itemId = await publicItem()
	const convId = await pendingConversation(borrower, itemId)

	// The outsider isn't the requester or itemOwner. The conversation viewRule/
	// updateRule already scopes access to participants, so a direct PATCH is
	// rejected; the hook is the belt-and-braces guard on the abort transition.
	const res = await api('PATCH', `/api/collections/conversations/records/${convId}`, outsider.t, {
		lendingStatus: 'aborted',
	})
	assert.notEqual(res.status, 200, 'non-participant cannot abort')
	assert.ok(res.status === 403 || res.status === 404, `expected 403/404, got ${res.status}`)
})
