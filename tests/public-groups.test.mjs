// Public / self-join groups: anyone may read a public group + self-join it,
// private groups stay invite-only, and self-join can only add yourself.
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { startPB, stopPB, makeUser, api } from './harness.mjs'

let pb, owner, joiner, other

before(async () => {
	pb = await startPB()
	owner = await makeUser('pgowner')
	joiner = await makeUser('pgjoiner')
	other = await makeUser('pgother')
})

after(() => stopPB(pb))

async function makeGroup(name, isPublic) {
	const g = await api('POST', '/api/collections/groups/records', owner.t, {
		name,
		description: 'Was wir teilen',
		owner: owner.id,
		isPublic: !!isPublic,
	})
	assert.equal(g.status, 200)
	return g.json.id
}

test('anyone authenticated can read a PUBLIC group (name + description)', async () => {
	const g = await makeGroup('Uni Lueneburg', true)
	const r = await api('GET', `/api/collections/groups/records/${g}`, other.t)
	assert.equal(r.status, 200, 'public group readable by a non-member')
	assert.equal(r.json.description, 'Was wir teilen', 'description visible to prospective members')
})

test('a PRIVATE group is not readable by a non-member', async () => {
	const g = await makeGroup('Privatkreis', false)
	assert.equal((await api('GET', `/api/collections/groups/records/${g}`, other.t)).status, 404)
})

test('a user can self-join a PUBLIC group and then see its items', async () => {
	const g = await makeGroup('SelfJoinable', true)
	const it = await api('POST', '/api/collections/items/records', owner.t, {
		name: 'Beamer', description: 'd', place: 'p', owner: owner.id,
		trusteesOnly: true, groups: [g], status: 'available',
	})
	// before joining: no access
	assert.equal((await api('GET', `/api/collections/items/records/${it.json.id}`, joiner.t)).status, 404)
	// self-join
	const join = await api('POST', '/api/collections/group_members/records', joiner.t, {
		group: g, user: joiner.id, role: 'member',
	})
	assert.equal(join.status, 200, 'self-join of a public group succeeds')
	// after joining: access
	assert.equal((await api('GET', `/api/collections/items/records/${it.json.id}`, joiner.t)).status, 200, 'member sees the group item')
})

test('self-join is rejected for a PRIVATE group', async () => {
	const g = await makeGroup('NoSelfJoin', false)
	const join = await api('POST', '/api/collections/group_members/records', joiner.t, {
		group: g, user: joiner.id, role: 'member',
	})
	assert.notEqual(join.status, 200, 'cannot self-join a private group')
})

test('self-join cannot add someone OTHER than yourself', async () => {
	const g = await makeGroup('OnlySelf', true)
	const sneaky = await api('POST', '/api/collections/group_members/records', joiner.t, {
		group: g, user: other.id, role: 'member',
	})
	assert.notEqual(sneaky.status, 200, 'a public group lets you add only yourself')
})

test('self-join cannot grant yourself the admin role', async () => {
	const g = await makeGroup('NoSelfAdmin', true)
	const sneaky = await api('POST', '/api/collections/group_members/records', joiner.t, {
		group: g, user: joiner.id, role: 'admin',
	})
	assert.notEqual(sneaky.status, 200, 'self-join must not be allowed to set role=admin')
	// a plain member self-join still works
	const ok = await api('POST', '/api/collections/group_members/records', joiner.t, {
		group: g, user: joiner.id, role: 'member',
	})
	assert.equal(ok.status, 200, 'self-join as member still works')
})
