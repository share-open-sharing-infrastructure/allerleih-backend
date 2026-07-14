// Hardening of over-permissive rules (migration 1783700001):
//   - messages.createRule now enforces authorship (`from` = caller), conversation
//     membership, and that the recipient is the conversation's other participant.
//   - feedback.listRule / searches.listRule are superusers-only (were public);
//     createRule stays public so submissions/logging still work.
// These are collection rules, so they can only be exercised against a real
// PocketBase instance.
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { startPB, stopPB, api, adminAuth, makeUser } from './harness.mjs'

let pb
let owner, requester, attacker, itemId, convId

before(async () => {
	pb = await startPB()
	owner = await makeUser('owner')
	requester = await makeUser('requester')
	attacker = await makeUser('attacker')

	const item = await api('POST', '/api/collections/items/records', owner.t, {
		name: 'Bohrmaschine',
		owner: owner.id,
		trusteesOnly: false,
	})
	assert.equal(item.status, 200, JSON.stringify(item.json))
	itemId = item.json.id

	const conv = await api('POST', '/api/collections/conversations/records', requester.t, {
		requester: requester.id,
		itemOwner: owner.id,
		requestedItem: itemId,
	})
	assert.equal(conv.status, 200, JSON.stringify(conv.json))
	convId = conv.json.id
})

after(() => stopPB(pb))

function sendMessage(token, from, to, conversation) {
	const body = { from, to, messageContent: 'hi' }
	if (conversation !== undefined) body.conversation = conversation
	return api('POST', '/api/collections/messages/records', token, body)
}

test('a participant can send a message authored by themselves', async () => {
	const a = await sendMessage(requester.t, requester.id, owner.id, convId)
	assert.equal(a.status, 200, JSON.stringify(a.json))
	const b = await sendMessage(owner.t, owner.id, requester.id, convId)
	assert.equal(b.status, 200, JSON.stringify(b.json))
})

test('a third party cannot forge a message with a spoofed sender', async () => {
	const res = await sendMessage(attacker.t, owner.id, requester.id, convId)
	assert.notEqual(res.status, 200, 'sender spoofing must be rejected')
})

test('a non-participant cannot inject a message into a conversation', async () => {
	const res = await sendMessage(attacker.t, attacker.id, owner.id, convId)
	assert.notEqual(res.status, 200, 'non-participant injection must be rejected')
})

test('a message without a conversation is rejected', async () => {
	const res = await sendMessage(requester.t, requester.id, owner.id, undefined)
	assert.notEqual(res.status, 200, 'orphan messages must be rejected')
})

test('a participant cannot spoof the sender inside their own conversation', async () => {
	const res = await sendMessage(requester.t, owner.id, requester.id, convId)
	assert.notEqual(res.status, 200, 'from must be the caller')
})

test('feedback: anyone can submit, but only superusers can list', async () => {
	const create = await api('POST', '/api/collections/feedback/records', null, { feedbackMessage: 'hi' })
	assert.equal(create.status, 200, JSON.stringify(create.json))

	const unauth = await api('GET', '/api/collections/feedback/records', null)
	assert.equal(unauth.status, 403, JSON.stringify(unauth.json))

	const su = await api('GET', '/api/collections/feedback/records', adminAuth())
	assert.equal(su.status, 200, JSON.stringify(su.json))
})

test('searches: logging stays public, listing is superusers-only', async () => {
	const create = await api('POST', '/api/collections/searches/records', null, { query: 'x' })
	assert.equal(create.status, 200, JSON.stringify(create.json))

	const unauth = await api('GET', '/api/collections/searches/records', null)
	assert.equal(unauth.status, 403, JSON.stringify(unauth.json))

	const su = await api('GET', '/api/collections/searches/records', adminAuth())
	assert.equal(su.status, 200, JSON.stringify(su.json))
})
