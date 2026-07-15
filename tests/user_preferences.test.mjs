// user_preferences (issue #426): preferredTransportMode + hasOnboarded were pulled
// off the users table into this owner-only sidecar. Verifies the schema moved, the
// owner-only rules hold, and the two fields round-trip.
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { startPB, stopPB, makeUser, api, adminAuth } from './harness.mjs'

let pb, alice, bob

before(async () => {
	pb = await startPB()
	alice = await makeUser('alice')
	bob = await makeUser('bob')
})

after(() => stopPB(pb))

async function fieldNames(collection) {
	const r = await api('GET', `/api/collections/${collection}`, adminAuth())
	assert.equal(r.status, 200, `read ${collection} schema`)
	return (r.json.fields || []).map((f) => f.name)
}

test('the two fields no longer exist on the users collection', async () => {
	const names = await fieldNames('users')
	assert.ok(!names.includes('preferredTransportMode'), 'preferredTransportMode dropped from users')
	assert.ok(!names.includes('hasOnboarded'), 'hasOnboarded dropped from users')
})

test('the two fields exist on user_preferences (alongside emailNotifications)', async () => {
	const names = await fieldNames('user_preferences')
	assert.ok(names.includes('emailNotifications'), 'emailNotifications present')
	assert.ok(names.includes('preferredTransportMode'), 'preferredTransportMode moved in')
	assert.ok(names.includes('hasOnboarded'), 'hasOnboarded moved in')
})

test('an owner can create and read back their own preferences row', async () => {
	const created = await api('POST', '/api/collections/user_preferences/records', alice.t, {
		user: alice.id,
		preferredTransportMode: 'foot',
		hasOnboarded: true,
	})
	assert.equal(created.status, 200, JSON.stringify(created.json))
	assert.equal(created.json.preferredTransportMode, 'foot')
	assert.equal(created.json.hasOnboarded, true)

	const updated = await api(
		'PATCH',
		`/api/collections/user_preferences/records/${created.json.id}`,
		alice.t,
		{ preferredTransportMode: 'car' }
	)
	assert.equal(updated.status, 200)
	assert.equal(updated.json.preferredTransportMode, 'car')
	assert.equal(updated.json.hasOnboarded, true, 'unrelated field untouched')
})

test('the unique index allows only one preferences row per user', async () => {
	const dup = await api('POST', '/api/collections/user_preferences/records', alice.t, {
		user: alice.id,
		hasOnboarded: false,
	})
	assert.notEqual(dup.status, 200, 'a second row for the same user is rejected')
})

test('a user cannot read another user\'s preferences row (owner-only)', async () => {
	const list = await api(
		'GET',
		`/api/collections/user_preferences/records?filter=${encodeURIComponent(`user = "${alice.id}"`)}`,
		bob.t
	)
	assert.equal(list.status, 200)
	assert.equal(list.json.totalItems, 0, "bob sees none of alice's preferences")

	const create = await api('POST', '/api/collections/user_preferences/records', bob.t, {
		user: alice.id,
		hasOnboarded: true,
	})
	assert.notEqual(create.status, 200, 'bob cannot create a preferences row owned by alice')
})
