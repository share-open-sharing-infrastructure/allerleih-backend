// Platform legal-consent security properties (Issue #399). These exercise the
// hardening from the code review: the consent gate cannot be bypassed by writing
// the user's own version cache (#1), the audit trail cannot be forged via a direct
// create (#2), accept/decline are server-authoritative & transactional (#2/#3/#5),
// a declined account is locked at the DATA layer (#4), and re-accepting unlocks (#9).
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { startPB, stopPB, makeUser, api, adminAuth } from './harness.mjs'

let pb
before(async () => { pb = await startPB() })
after(() => stopPB(pb))

const filt = (s) => encodeURIComponent(s)

test('active legal documents are world-readable; exactly one active per type', async () => {
	const docs = await api('GET', '/api/collections/legal_documents/records', null)
	assert.equal(docs.status, 200, 'guests can read active docs (needed by /misc/tos|privacy)')
	const types = docs.json.items.map((d) => d.docType).sort()
	assert.deepEqual(types, ['privacy', 'tos'], 'one active tos + one active privacy')
})

test('a new user is auto-consented to the active versions and has accepted audit records', async () => {
	const u = await makeUser('legalu1')
	const rec = await api('GET', `/api/collections/users/records/${u.id}`, adminAuth())
	assert.equal(rec.json.tosAcceptedVersion, '1.3')
	assert.equal(rec.json.privacyAcceptedVersion, '2.9')
	assert.equal(rec.json.legalLocked, false)

	const acc = await api('GET', `/api/collections/user_legal_acceptances/records?filter=${filt(`user="${u.id}"`)}`, u.t)
	assert.equal(acc.status, 200)
	assert.ok(acc.json.totalItems >= 2, 'tos + privacy acceptance recorded at registration')
	assert.ok(acc.json.items.every((r) => r.decision === 'accepted'))
})

test('a user CANNOT patch their own version cache — gate bypass blocked (#1)', async () => {
	const u = await makeUser('legalu2')
	const r = await api('PATCH', `/api/collections/users/records/${u.id}`, u.t, { tosAcceptedVersion: '999' })
	assert.notEqual(r.status, 200, 'updateRule must reject writes touching the version cache')
	const after = await api('GET', `/api/collections/users/records/${u.id}`, adminAuth())
	assert.equal(after.json.tosAcceptedVersion, '1.3', 'version cache unchanged')
})

test('a user CANNOT self-clear the legal lock (#1)', async () => {
	const u = await makeUser('legalu2b')
	await api('POST', '/api/legal/decline', u.t)
	const r = await api('PATCH', `/api/collections/users/records/${u.id}`, u.t, { legalLocked: false })
	assert.notEqual(r.status, 200)
	const after = await api('GET', `/api/collections/users/records/${u.id}`, adminAuth())
	assert.equal(after.json.legalLocked, true, 'still locked')
})

test('a user CANNOT forge an acceptance record directly — createRule=null (#2)', async () => {
	const u = await makeUser('legalu3')
	const r = await api('POST', '/api/collections/user_legal_acceptances/records', u.t, {
		user: u.id, docType: 'tos', version: '999', decision: 'accepted', bodySnapshot: 'fabricated',
	})
	assert.notEqual(r.status, 200, 'direct client create of an audit record must be rejected')
})

test('decline locks the account at the data layer; accept self-recovers (#3/#4/#9)', async () => {
	const u = await makeUser('legalu4')

	// baseline: a non-locked user can mutate their own data
	const baseline = await api('PATCH', `/api/collections/users/records/${u.id}`, u.t, { bio: 'hello' })
	assert.equal(baseline.status, 200, 'non-locked user can mutate (no regression from the lock guard)')

	// decline -> locked + declined audit records (server snapshot)
	const dec = await api('POST', '/api/legal/decline', u.t)
	assert.equal(dec.status, 200)
	const locked = await api('GET', `/api/collections/users/records/${u.id}`, adminAuth())
	assert.equal(locked.json.legalLocked, true)
	const declined = await api('GET', `/api/collections/user_legal_acceptances/records?filter=${filt(`user="${u.id}" && decision="declined"`)}`, u.t)
	assert.ok(declined.json.totalItems >= 2, 'declined records written for both docs')

	// locked user is blocked from data mutations (#4)
	const blockedUpdate = await api('PATCH', `/api/collections/users/records/${u.id}`, u.t, { bio: 'nope' })
	assert.notEqual(blockedUpdate.status, 200, 'locked user cannot update')
	const blockedCreate = await api('POST', '/api/collections/groups/records', u.t, { name: 'lockedgroup', owner: u.id })
	assert.notEqual(blockedCreate.status, 200, 'locked user cannot create')

	// accept -> unlock + fresh accepted records
	const acc = await api('POST', '/api/legal/accept', u.t)
	assert.equal(acc.status, 200)
	const unlocked = await api('GET', `/api/collections/users/records/${u.id}`, adminAuth())
	assert.equal(unlocked.json.legalLocked, false, 'self-recovered')

	// ...and can mutate again
	const recovered = await api('PATCH', `/api/collections/users/records/${u.id}`, u.t, { bio: 'recovered' })
	assert.equal(recovered.status, 200, 'unlocked user can mutate again')
})

test('accept + decline require authentication', async () => {
	const a = await api('POST', '/api/legal/accept', null)
	assert.equal(a.status, 401)
	const d = await api('POST', '/api/legal/decline', null)
	assert.equal(d.status, 401)
})

test('a locked user is refused by mutating custom routes too — group-invite/join (#1, round 2)', async () => {
	const owner = await makeUser('legalowner')
	const joiner = await makeUser('legaljoiner')
	const g = await api('POST', '/api/collections/groups/records', owner.t, { name: 'LockTest', owner: owner.id })
	assert.equal(g.status, 200)
	const inv = await api('POST', '/api/collections/group_invites/records', owner.t, { group: g.json.id })
	assert.equal(inv.status, 200)
	const token = inv.json.token

	// Sanity: a non-locked user could join.
	const okJoin = await api('POST', `/api/group-invite/${token}/join`, joiner.t)
	assert.equal(okJoin.status, 200, 'baseline: unlocked user joins')

	// A different user who declined (locked) must NOT be able to join via the custom route.
	const locked = await makeUser('legallocked')
	await api('POST', '/api/legal/decline', locked.t)
	const blocked = await api('POST', `/api/group-invite/${token}/join`, locked.t)
	assert.equal(blocked.status, 403, 'locked user blocked from custom mutating route')
})

test('legalLocked cannot be set at user create — server pins it false (#2, round 2)', async () => {
	const created = await api('POST', '/api/collections/users/records', adminAuth(), {
		email: 'pinned@test.local',
		password: 'test1234',
		passwordConfirm: 'test1234',
		username: 'pinneduser',
		legalLocked: true
	})
	assert.equal(created.status, 200)
	assert.equal(created.json.legalLocked, false, 'create hook pins legalLocked=false regardless of payload')
})
