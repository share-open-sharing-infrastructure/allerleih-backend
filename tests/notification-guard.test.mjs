// notification_guard.pb.js — a notification is delivered to `recipient`, so
// without a server-side check any authenticated user could create one for anyone.
// The guard enforces: sender = caller, and the (sender, recipient) pair reflects a
// real event for the type (conversation participants, or an existing trusts edge).
// These are hook-enforced request rules, so they need a real PocketBase instance.
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { startPB, stopPB, api, adminAuth, makeUser } from './harness.mjs'

let pb
let owner, requester, attacker, convId

const notif = (token, body) => api('POST', '/api/collections/notifications/records', token, body)

before(async () => {
	pb = await startPB()
	owner = await makeUser('nowner')
	requester = await makeUser('nrequester')
	attacker = await makeUser('nattacker')

	const item = await api('POST', '/api/collections/items/records', owner.t, {
		name: 'Bohrer',
		owner: owner.id,
		trusteesOnly: false,
	})
	assert.equal(item.status, 200, JSON.stringify(item.json))

	const conv = await api('POST', '/api/collections/conversations/records', requester.t, {
		requester: requester.id,
		itemOwner: owner.id,
		requestedItem: item.json.id,
	})
	assert.equal(conv.status, 200, JSON.stringify(conv.json))
	convId = conv.json.id

	// requester trusts attacker, so a legit trust_added requester -> attacker is possible
	const trust = await api('POST', '/api/collections/trusts/records', requester.t, {
		truster: requester.id,
		trustee: attacker.id,
	})
	assert.equal(trust.status, 200, JSON.stringify(trust.json))
})

after(() => stopPB(pb))

test('a participant can create a conversation notification for the other participant', async () => {
	const a = await notif(requester.t, {
		sender: requester.id,
		recipient: owner.id,
		type: 'new_request',
		relatedId: convId,
		body: 'x',
	})
	assert.equal(a.status, 200, JSON.stringify(a.json))

	const b = await notif(owner.t, {
		sender: owner.id,
		recipient: requester.id,
		type: 'new_message',
		relatedId: convId,
		body: 'x',
	})
	assert.equal(b.status, 200, JSON.stringify(b.json))
})

test('the truster can create a trust notification for the trustee', async () => {
	const res = await notif(requester.t, {
		sender: requester.id,
		recipient: attacker.id,
		type: 'trust_added',
		relatedId: requester.id,
		body: 'x',
	})
	assert.equal(res.status, 200, JSON.stringify(res.json))
})

test('a conversation notification with a bogus relatedId is rejected', async () => {
	const res = await notif(attacker.t, {
		sender: attacker.id,
		recipient: owner.id,
		type: 'new_message',
		relatedId: 'not-a-conversation',
		body: 'phish',
	})
	assert.notEqual(res.status, 200)
})

test('a non-participant cannot notify into a conversation they are not part of', async () => {
	const res = await notif(attacker.t, {
		sender: attacker.id,
		recipient: owner.id,
		type: 'new_message',
		relatedId: convId,
		body: 'phish',
	})
	assert.notEqual(res.status, 200)
})

test('the sender cannot be spoofed', async () => {
	const res = await notif(attacker.t, {
		sender: owner.id,
		recipient: requester.id,
		type: 'new_message',
		relatedId: convId,
		body: 'phish',
	})
	assert.notEqual(res.status, 200)
})

test('a trust notification without an existing trust edge is rejected', async () => {
	const res = await notif(attacker.t, {
		sender: attacker.id,
		recipient: owner.id,
		type: 'trust_added',
		relatedId: attacker.id,
		body: 'phish',
	})
	assert.notEqual(res.status, 200)
})

test('an unknown notification type from a user is rejected', async () => {
	const res = await notif(attacker.t, {
		sender: attacker.id,
		recipient: owner.id,
		type: 'totally_made_up',
		relatedId: convId,
		body: 'phish',
	})
	assert.notEqual(res.status, 200)
})

test('a superuser is not subject to the guard', async () => {
	const res = await notif(adminAuth(), {
		sender: owner.id,
		recipient: requester.id,
		type: 'new_message',
		relatedId: 'anything',
		body: 'system',
	})
	assert.equal(res.status, 200, JSON.stringify(res.json))
})
