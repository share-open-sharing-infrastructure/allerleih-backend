// Presence-based email suppression:
//  - messages.conversation relation is set on create and used by the hook
//  - *LastSeenAt updateRule prevents cross-party writes
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { startPB, stopPB, makeUser, api, adminAuth } from './harness.mjs'

let pb, ownerA, requesterB

before(async () => {
	pb = await startPB()
	ownerA = await makeUser('powner')
	requesterB = await makeUser('preqstr')
})

after(() => stopPB(pb))

async function createItem(owner) {
	const res = await api('POST', '/api/collections/items/records', owner.t, {
		name: 'Presence Test Item',
		description: 'for testing presence suppression',
		place: 'here',
		owner: owner.id,
		trusteesOnly: false,
		status: 'available',
	})
	assert.equal(res.status, 200, 'item created')
	return res.json.id
}

async function createConversation(requester, owner, itemId) {
	const res = await api('POST', '/api/collections/conversations/records', requester.t, {
		requester: requester.id,
		itemOwner: owner.id,
		requestedItem: itemId,
	})
	assert.equal(res.status, 200, 'conversation created')
	return res.json.id
}

test('a message can be created with the conversation relation', async () => {
	const itemId = await createItem(ownerA)
	const convId = await createConversation(requesterB, ownerA, itemId)

	const msg = await api('POST', '/api/collections/messages/records', requesterB.t, {
		messageContent: 'Hello!',
		from: requesterB.id,
		to: ownerA.id,
		conversation: convId,
	})
	assert.equal(msg.status, 200, 'message created with conversation field')
	assert.equal(msg.json.conversation, convId, 'conversation relation is stored')
})

test('requester can write requesterLastSeenAt but NOT ownerLastSeenAt', async () => {
	const itemId = await createItem(ownerA)
	const convId = await createConversation(requesterB, ownerA, itemId)

	// Requester can write their own field
	const ok = await api('PATCH', `/api/collections/conversations/records/${convId}`, requesterB.t, {
		requesterLastSeenAt: new Date().toISOString(),
	})
	assert.equal(ok.status, 200, 'requester can set requesterLastSeenAt')

	// Requester cannot write the owner's field
	const bad = await api('PATCH', `/api/collections/conversations/records/${convId}`, requesterB.t, {
		ownerLastSeenAt: new Date().toISOString(),
	})
	assert.notEqual(bad.status, 200, 'requester cannot set ownerLastSeenAt')
})

test('owner can write ownerLastSeenAt but NOT requesterLastSeenAt', async () => {
	const itemId = await createItem(ownerA)
	const convId = await createConversation(requesterB, ownerA, itemId)

	// Owner can write their own field
	const ok = await api('PATCH', `/api/collections/conversations/records/${convId}`, ownerA.t, {
		ownerLastSeenAt: new Date().toISOString(),
	})
	assert.equal(ok.status, 200, 'owner can set ownerLastSeenAt')

	// Owner cannot write the requester's field
	const bad = await api('PATCH', `/api/collections/conversations/records/${convId}`, ownerA.t, {
		requesterLastSeenAt: new Date().toISOString(),
	})
	assert.notEqual(bad.status, 200, 'owner cannot set requesterLastSeenAt')
})

test('conversation list can sort by lastMessageAt', async () => {
	const item1 = await createItem(ownerA)
	const item2 = await createItem(ownerA)
	const conv1 = await createConversation(requesterB, ownerA, item1)
	const conv2 = await createConversation(requesterB, ownerA, item2)

	// Set lastMessageAt: conv1 is older, conv2 is newer
	await api('PATCH', `/api/collections/conversations/records/${conv1}`, requesterB.t, {
		requesterLastSeenAt: new Date().toISOString(),
	})
	// Use admin to set lastMessageAt (bypasses field restrictions)
	await api('PATCH', `/api/collections/conversations/records/${conv1}`, adminAuth(), {
		lastMessageAt: '2025-01-01 00:00:00.000Z',
	})
	await api('PATCH', `/api/collections/conversations/records/${conv2}`, adminAuth(), {
		lastMessageAt: '2026-06-01 00:00:00.000Z',
	})

	// Sort by -lastMessageAt
	const list = await api('GET', `/api/collections/conversations/records?sort=-lastMessageAt&filter=${encodeURIComponent(`requester="${requesterB.id}"`)}`, requesterB.t)
	assert.equal(list.status, 200)
	assert.ok(list.json.items.length >= 2, 'at least 2 conversations returned')
	// conv2 (newer lastMessageAt) should come first
	assert.equal(list.json.items[0].id, conv2, 'newest message conversation is first')
})
