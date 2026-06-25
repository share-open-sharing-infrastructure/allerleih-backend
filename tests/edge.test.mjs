// Auth + boundary cases for invites and membership that the happy-path tests
// don't cover: public preview vs. authenticated join, unlimited invites, and the
// unique-membership constraint.
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { startPB, stopPB, makeUser, api } from './harness.mjs'

let pb, owner

before(async () => {
	pb = await startPB()
	owner = await makeUser('edgeowner')
})

after(() => stopPB(pb))

async function newGroup(name) {
	const g = await api('POST', '/api/collections/groups/records', owner.t, { name, owner: owner.id })
	assert.equal(g.status, 200)
	return g.json.id
}

test('an invite can be previewed without logging in, but joining requires auth', async () => {
	const groupId = await newGroup('PublicPreview')
	const inv = await api('POST', '/api/collections/group_invites/records', owner.t, { group: groupId })

	// preview works with NO auth token (guests may see who invited them)
	const preview = await api('GET', `/api/group-invite/${inv.json.token}`)
	assert.equal(preview.status, 200)
	assert.equal(preview.json.group.name, 'PublicPreview')

	// joining with NO auth token is rejected by requireAuth
	const join = await api('POST', `/api/group-invite/${inv.json.token}/join`)
	assert.equal(join.status, 401, 'guest cannot join')
})

test('maxUses = 0 means unlimited joins', async () => {
	const groupId = await newGroup('Unlimited')
	const inv = await api('POST', '/api/collections/group_invites/records', owner.t, {
		group: groupId,
		uses: 0,
		maxUses: 0,
	})

	const u1 = await makeUser('unlim1')
	const u2 = await makeUser('unlim2')
	const u3 = await makeUser('unlim3')
	for (const u of [u1, u2, u3]) {
		const j = await api('POST', `/api/group-invite/${inv.json.token}/join`, u.t)
		assert.equal(j.status, 200, `${u.username} joins`)
		assert.equal(j.json.joined, true)
	}

	const after = await api('GET', `/api/collections/group_invites/records/${inv.json.id}`, owner.t)
	assert.equal(after.json.uses, 3, 'every distinct join counted, none blocked')
})

test('the owner cannot add the same member twice (unique membership)', async () => {
	const groupId = await newGroup('NoDupes')
	const m = await makeUser('dupe')

	const first = await api('POST', '/api/collections/group_members/records', owner.t, { group: groupId, user: m.id })
	assert.equal(first.status, 200, 'first add works')

	const second = await api('POST', '/api/collections/group_members/records', owner.t, { group: groupId, user: m.id })
	assert.notEqual(second.status, 200, 'duplicate membership rejected by unique index')

	const rows = await api('GET', `/api/collections/group_members/records?filter=${encodeURIComponent(`group="${groupId}" && user="${m.id}"`)}`, owner.t)
	assert.equal(rows.json.totalItems, 1, 'still exactly one membership')
})
