// Issue #557 / allerleih-backend#41 — email normalization (defense-in-depth + backfill).
//
// PocketBase matches emails case-sensitively and doesn't normalize on save, so a mixed-case
// registration produces an account login/password-reset can never reach. This suite pins:
//   (a) creating a user with a mixed-case/whitespaced email stores it lower-cased (create hook)
//   (b) updating a user's email to mixed-case normalizes it too (update hook)
//   (c) the backfill migration's planner normalizes lone existing rows
//   (d) a case-collision pair is reported (skipped), not silently merged
//
// (a)/(b) run end-to-end against a real PocketBase (the hooks live in account.pb.js). (c)/(d)
// unit-test the shared planner directly: the migration applies to an EMPTY db under the harness
// (no rows to heal), so its destructive loop can't be exercised through HTTP — but the migration
// and the hook both `require()` this exact function, so testing it is testing the real logic.
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { startPB, stopPB, api, adminAuth } from './harness.mjs'
import { normalizeEmail, planEmailNormalization } from '../pb_hooks/utils/email.js'

let pb

before(async () => {
	pb = await startPB()
})
after(() => stopPB(pb))

async function createUser(email, username) {
	const password = 'test1234'
	return api('POST', '/api/collections/users/records', adminAuth(), {
		email,
		password,
		passwordConfirm: password,
		username,
	})
}

// (a) create hook
test('creating a user with a mixed-case, padded email stores it lower-cased', async () => {
	const created = await createUser('  Julika7@Ich-Will-Net.DE  ', 'julikacreate')
	assert.equal(created.status, 200, 'user created')
	assert.equal(created.json.email, 'julika7@ich-will-net.de', 'stored email is normalized')

	const row = await api('GET', `/api/collections/users/records/${created.json.id}`, adminAuth())
	assert.equal(row.json.email, 'julika7@ich-will-net.de', 'persisted email is normalized')

	// The whole point of #557: the lower-case form the user types can authenticate.
	const auth = await api('POST', '/api/collections/users/auth-with-password', null, {
		identity: 'julika7@ich-will-net.de',
		password: 'test1234',
	})
	assert.equal(auth.status, 200, 'login with the lower-case address succeeds')
})

// (b) update hook
test('updating a user email to mixed-case normalizes it', async () => {
	const created = await createUser('plain.user@example.com', 'plainupdate')
	assert.equal(created.status, 200)

	const patched = await api(
		'PATCH',
		`/api/collections/users/records/${created.json.id}`,
		adminAuth(),
		{ email: 'Plain.User+NEW@Example.COM' }
	)
	assert.equal(patched.status, 200, 'email update accepted')
	assert.equal(patched.json.email, 'plain.user+new@example.com', 'updated email normalized')
})

// (c) backfill planner — lone rows
test('planner normalizes lone mixed-case rows and leaves already-normal ones untouched', async () => {
	const { updates, collisions } = planEmailNormalization([
		{ id: 'a', email: 'Mixed@Case.DE' },
		{ id: 'b', email: 'already@lower.de' },
		{ id: 'c', email: '  Padded@Space.DE ' },
		{ id: 'd', email: '' }, // blank ignored
	])
	assert.deepEqual(collisions, [], 'no collisions among distinct addresses')
	const byId = Object.fromEntries(updates.map((u) => [u.id, u.to]))
	assert.deepEqual(byId, {
		a: 'mixed@case.de',
		c: 'padded@space.de',
	}, 'only the mixed-case rows are scheduled for update')
	assert.ok(!('b' in byId), 'already-normalized row is not rewritten')
	assert.ok(!('d' in byId), 'blank email is ignored')
})

// (d) backfill planner — collision is skipped, not merged
test('planner reports a case-collision pair and schedules neither for update', async () => {
	const { updates, collisions } = planEmailNormalization([
		{ id: 'x', email: 'Foo@x.de' },
		{ id: 'y', email: 'foo@x.de' },
		{ id: 'z', email: 'Safe@x.de' },
	])
	assert.equal(collisions.length, 1, 'exactly one collision group')
	assert.equal(collisions[0].normalized, 'foo@x.de')
	assert.deepEqual(collisions[0].ids.slice().sort(), ['x', 'y'], 'both colliding ids reported')

	const updatedIds = updates.map((u) => u.id)
	assert.ok(!updatedIds.includes('x') && !updatedIds.includes('y'), 'colliding rows are NOT updated')
	assert.deepEqual(updatedIds, ['z'], 'only the non-colliding mixed-case row is normalized')
})

// normalizeEmail primitive
test('normalizeEmail trims and lower-cases, tolerating nullish input', async () => {
	assert.equal(normalizeEmail('  A@B.DE '), 'a@b.de')
	assert.equal(normalizeEmail('already@lower.de'), 'already@lower.de')
	assert.equal(normalizeEmail(null), '')
	assert.equal(normalizeEmail(undefined), '')
})
