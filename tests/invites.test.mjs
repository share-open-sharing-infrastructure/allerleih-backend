// Invite-link semantics: usage cap, idempotent join, expiry.
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { startPB, stopPB, makeUser, api } from './harness.mjs'

let pb, owner, a, b

before(async () => {
	pb = await startPB()
	owner = await makeUser('owner')
	a = await makeUser('aaa')
	b = await makeUser('bbb')
})

after(() => stopPB(pb))

async function newGroup(name) {
	const g = await api('POST', '/api/collections/groups/records', owner.t, { name, owner: owner.id })
	assert.equal(g.status, 200)
	return g.json.id
}

test('maxUses caps the number of joins and is not over-counted', async () => {
	const groupId = await newGroup('Capped')
	const inv = await api('POST', '/api/collections/group_invites/records', owner.t, {
		group: groupId,
		uses: 0,
		maxUses: 1,
	})

	// first join consumes the single use
	const j1 = await api('POST', `/api/group-invite/${inv.json.token}/join`, a.t)
	assert.equal(j1.status, 200)
	assert.equal(j1.json.joined, true)

	// a different user is blocked once the cap is reached
	const j2 = await api('POST', `/api/group-invite/${inv.json.token}/join`, b.t)
	assert.equal(j2.status, 410)
	assert.equal(j2.json.reason, 'used_up')

	// b did not become a member, and uses stayed exactly 1
	const memb = await api('GET', `/api/collections/group_members/records?filter=${encodeURIComponent(`group="${groupId}" && user="${b.id}"`)}`, owner.t)
	assert.equal(memb.json.totalItems, 0)
	const after = await api('GET', `/api/collections/group_invites/records/${inv.json.id}`, owner.t)
	assert.equal(after.json.uses, 1)
})

test('re-joining is idempotent and does not consume an extra use', async () => {
	const groupId = await newGroup('Idempotent')
	const inv = await api('POST', '/api/collections/group_invites/records', owner.t, { group: groupId, uses: 0, maxUses: 0 })

	const first = await api('POST', `/api/group-invite/${inv.json.token}/join`, a.t)
	assert.equal(first.json.alreadyMember, false)

	const second = await api('POST', `/api/group-invite/${inv.json.token}/join`, a.t)
	assert.equal(second.status, 200)
	assert.equal(second.json.alreadyMember, true)

	const after = await api('GET', `/api/collections/group_invites/records/${inv.json.id}`, owner.t)
	assert.equal(after.json.uses, 1, 'uses incremented once, not twice')
})

test('the group owner joining their own invite is a no-op success', async () => {
	const groupId = await newGroup('OwnerJoin')
	const inv = await api('POST', '/api/collections/group_invites/records', owner.t, { group: groupId })
	const r = await api('POST', `/api/group-invite/${inv.json.token}/join`, owner.t)
	assert.equal(r.status, 200)
	assert.equal(r.json.alreadyMember, true)
})

test('an expired invite is rejected by both preview and join', async () => {
	const groupId = await newGroup('Expired')
	const inv = await api('POST', '/api/collections/group_invites/records', owner.t, {
		group: groupId,
		uses: 0,
		maxUses: 0,
		expiresAt: '2020-01-01 00:00:00.000Z', // in the past
	})
	const preview = await api('GET', `/api/group-invite/${inv.json.token}`)
	assert.equal(preview.status, 410)
	assert.equal(preview.json.reason, 'expired')

	const join = await api('POST', `/api/group-invite/${inv.json.token}/join`, a.t)
	assert.equal(join.status, 410)
	assert.equal(join.json.reason, 'expired')
})

test('an unknown token is a clean 404, not a server error', async () => {
	const preview = await api('GET', '/api/group-invite/doesnotexisttoken00000000')
	assert.equal(preview.status, 404)
	assert.equal(preview.json.reason, 'not_found')
})

test('a revoked invite no longer works', async () => {
	const groupId = await newGroup('Revoked')
	const inv = await api('POST', '/api/collections/group_invites/records', owner.t, { group: groupId })
	const token = inv.json.token

	// works before revoking
	assert.equal((await api('GET', `/api/group-invite/${token}`)).status, 200)

	// owner revokes (deletes) the invite
	const del = await api('DELETE', `/api/collections/group_invites/records/${inv.json.id}`, owner.t)
	assert.ok([200, 204].includes(del.status))

	// preview + join now fail as not_found
	assert.equal((await api('GET', `/api/group-invite/${token}`)).status, 404)
	const join = await api('POST', `/api/group-invite/${token}/join`, a.t)
	assert.equal(join.status, 404)
	assert.equal(join.json.reason, 'not_found')
})
