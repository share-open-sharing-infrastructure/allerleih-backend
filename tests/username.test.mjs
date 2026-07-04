// Issue #457 — the `users.username` field must accept internal spaces (institution
// display names) up to 50 chars, while still rejecting leading/trailing spaces and
// over-length values. These constraints live on the field's pattern/max (migration
// 1783400000), so they can only be exercised against a real PocketBase instance.
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { startPB, stopPB, api, adminAuth } from './harness.mjs'

let pb

before(async () => {
	pb = await startPB()
})

after(() => stopPB(pb))

// Create a user with an explicit (valid) email so the username can contain spaces.
async function createUser(username, emailLocal) {
	const password = 'test1234'
	return api('POST', '/api/collections/users/records', adminAuth(), {
		email: `${emailLocal}@test.local`,
		password,
		passwordConfirm: password,
		username,
	})
}

test('accepts a username with internal spaces', async () => {
	const res = await createUser('Ratsbücherei Lüneburg', 'rats')
	assert.equal(res.status, 200, JSON.stringify(res.json))
	assert.equal(res.json.username, 'Ratsbücherei Lüneburg')
})

test('accepts a username up to 50 chars', async () => {
	const name = 'a'.repeat(50)
	const res = await createUser(name, 'fifty')
	assert.equal(res.status, 200, JSON.stringify(res.json))
})

test('rejects a username longer than 50 chars', async () => {
	const res = await createUser('a'.repeat(51), 'toolong')
	assert.equal(res.status, 400)
	assert.ok(res.json?.data?.username, 'username field error expected')
})

test('rejects a leading space', async () => {
	const res = await createUser(' leadingspace', 'lead')
	assert.equal(res.status, 400)
	assert.ok(res.json?.data?.username, 'username field error expected')
})

test('rejects a trailing space', async () => {
	const res = await createUser('trailingspace ', 'trail')
	assert.equal(res.status, 400)
	assert.ok(res.json?.data?.username, 'username field error expected')
})

test('still accepts dots and hyphens (regression)', async () => {
	const res = await createUser('janun-e.V', 'janun')
	assert.equal(res.status, 200, JSON.stringify(res.json))
})
