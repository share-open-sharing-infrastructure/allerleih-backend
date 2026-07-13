// The `trusts` join collection: create/read/delete rules, the self-trust guard,
// the unique index, cascade + anonymize-in-place cleanup, and the contact-handle
// gating that reads it. A row {truster, trustee} means "truster trusts trustee".
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { startPB, stopPB, makeUser, api, adminAuth } from './harness.mjs'

let pb, alice, bob, carla, dave

before(async () => {
	pb = await startPB()
	alice = await makeUser('alice')
	bob = await makeUser('bob')
	carla = await makeUser('carla')
	dave = await makeUser('dave')
})

after(() => stopPB(pb))

const createEdge = (asUser, truster, trustee) =>
	api('POST', '/api/collections/trusts/records', asUser.t, { truster, trustee })

async function countTrusts(filter) {
	const r = await api(
		'GET',
		`/api/collections/trusts/records?filter=${encodeURIComponent(filter)}&perPage=1`,
		adminAuth()
	)
	assert.equal(r.status, 200)
	return r.json.totalItems
}

test('a user can create a trust edge where they are the truster', async () => {
	const r = await createEdge(alice, alice.id, bob.id)
	assert.equal(r.status, 200, 'alice trusts bob')
	assert.equal(r.json.truster, alice.id)
	assert.equal(r.json.trustee, bob.id)
})

test('the self-trust guard rejects truster === trustee', async () => {
	const r = await createEdge(alice, alice.id, alice.id)
	assert.notEqual(r.status, 200, 'self-trust must be rejected by the hook')
})

test('the unique index rejects a duplicate edge', async () => {
	// alice→bob already exists from the first test.
	const r = await createEdge(alice, alice.id, bob.id)
	assert.notEqual(r.status, 200, 'duplicate (truster, trustee) rejected')
})

test('createRule forbids creating an edge with someone else as truster', async () => {
	// bob tries to make it look like alice trusts carla.
	const r = await createEdge(bob, alice.id, carla.id)
	assert.notEqual(r.status, 200, 'cannot forge an edge you are not the truster of')
})

test('both parties can read the edge; a third party cannot', async () => {
	const edge = await createEdge(carla, carla.id, dave.id) // carla trusts dave
	assert.equal(edge.status, 200)
	const id = edge.json.id

	assert.equal((await api('GET', `/api/collections/trusts/records/${id}`, carla.t)).status, 200, 'truster reads it')
	assert.equal((await api('GET', `/api/collections/trusts/records/${id}`, dave.t)).status, 200, 'trustee reads it')
	assert.equal((await api('GET', `/api/collections/trusts/records/${id}`, bob.t)).status, 404, 'third party cannot')
})

test('deleteRule: only the truster can revoke the edge', async () => {
	const edge = await createEdge(bob, bob.id, carla.id) // bob trusts carla
	assert.equal(edge.status, 200)
	const id = edge.json.id

	// the trustee (carla) cannot delete it
	const denied = await api('DELETE', `/api/collections/trusts/records/${id}`, carla.t)
	assert.notEqual(denied.status, 200)
	assert.notEqual(denied.status, 204)

	// the truster (bob) can
	const ok = await api('DELETE', `/api/collections/trusts/records/${id}`, bob.t)
	assert.ok([200, 204].includes(ok.status))
})

test('hard-deleting a user cascades away their trust edges (both directions)', async () => {
	const x = await makeUser('cascadex')
	const y = await makeUser('cascadey')
	assert.equal((await createEdge(x, x.id, alice.id)).status, 200) // x trusts alice
	assert.equal((await createEdge(alice, alice.id, x.id)).status, 200) // alice trusts x

	// superuser hard-delete (FK-level cascade, unlike anonymize-in-place)
	const del = await api('DELETE', `/api/collections/users/records/${x.id}`, adminAuth())
	assert.ok([200, 204].includes(del.status))

	assert.equal(await countTrusts(`truster = "${x.id}"`), 0, 'edges where x is truster gone')
	assert.equal(await countTrusts(`trustee = "${x.id}"`), 0, 'edges where x is trustee gone')

	// bystander edge unaffected
	assert.ok((await createEdge(alice, alice.id, y.id)).status === 200)
})

test('anonymize-in-place account deletion removes the account\'s trust edges both ways', async () => {
	const victim = await makeUser('victim')
	const truster = await makeUser('trustsvictim')
	const trustee = await makeUser('victimtrusts')
	assert.equal((await createEdge(truster, truster.id, victim.id)).status, 200) // truster→victim
	assert.equal((await createEdge(victim, victim.id, trustee.id)).status, 200) // victim→trustee

	// self-service deletion keeps the users row (deleted=true) — cascade does NOT
	// fire, so anonymizeAccount must delete the edges explicitly.
	const del = await api('DELETE', '/api/account', victim.t, { password: 'test1234' })
	assert.equal(del.status, 200)

	const row = await api('GET', `/api/collections/users/records/${victim.id}`, adminAuth())
	assert.equal(row.json.deleted, true, 'anonymized in place (row kept)')
	assert.equal(await countTrusts(`truster = "${victim.id}"`), 0, 'victim outgoing edges gone')
	assert.equal(await countTrusts(`trustee = "${victim.id}"`), 0, 'victim incoming edges gone')
})

test('GDPR export reports the trust graph from the join', async () => {
	const u = await makeUser('exporttrust')
	const friend = await makeUser('exportfriend')
	const fan = await makeUser('exportfan')
	assert.equal((await createEdge(u, u.id, friend.id)).status, 200) // u trusts friend
	assert.equal((await createEdge(fan, fan.id, u.id)).status, 200) // fan trusts u

	const exp = await api('GET', '/api/account/export', u.t)
	assert.equal(exp.status, 200)
	assert.deepEqual(exp.json.trust.trusts, [friend.id], 'whom u trusts')
	assert.deepEqual(exp.json.trust.trustedBy, [fan.id], 'who trusts u')
})

test('contact handles gated by trust use the join: only a trustee sees a trusted-only handle', async () => {
	const owner = await makeUser('handleowner')
	const caller = await makeUser('handlecaller')
	// owner publishes BOTH a telegram and a signal handle, each visible to trusted only
	// (the two branches are independent lookups in contact.pb.js, so assert both).
	const c = await api('POST', '/api/collections/user_contacts/records', owner.t, {
		user: owner.id,
		telegramUsername: 'owner_tg',
		telegramVisibleToTrustedOnly: true,
		signalLink: 'https://signal.me/#p/owner',
		signalVisibleToTrustedOnly: true,
	})
	assert.equal(c.status, 200)

	// not trusted yet -> both handles withheld
	let res = await api('GET', `/api/contact/${owner.id}`, caller.t)
	assert.equal(res.status, 200)
	assert.equal(res.json.telegramUsername, null, 'telegram withheld from non-trustee')
	assert.equal(res.json.telegramHidden, true, 'telegram signalled as hidden')
	assert.equal(res.json.signalLink, null, 'signal withheld from non-trustee')
	assert.equal(res.json.signalHidden, true, 'signal signalled as hidden')

	// owner trusts caller -> both handles revealed
	assert.equal((await createEdge(owner, owner.id, caller.id)).status, 200)
	res = await api('GET', `/api/contact/${owner.id}`, caller.t)
	assert.equal(res.status, 200)
	assert.equal(res.json.telegramUsername, 'owner_tg', 'telegram revealed to trustee')
	assert.equal(res.json.telegramHidden, false)
	assert.equal(res.json.signalLink, 'https://signal.me/#p/owner', 'signal revealed to trustee')
	assert.equal(res.json.signalHidden, false)
})
