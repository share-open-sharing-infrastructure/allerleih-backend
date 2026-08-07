// Business-metrics project: conversations.acceptedAt/completedAt stamping
// (lending_timestamps.pb.js) and the nightly metrics_daily snapshot
// (metrics.pb.js / jobs/metrics.js). The cron itself can't be fired on demand, so
// the harness starts PocketBase with METRICS_TEST_ROUTE=true and the tests trigger
// it through the guarded POST /api/_test/run-metrics-snapshot route.
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { startPB, stopPB, makeUser, api, adminAuth } from './harness.mjs'

let pb

before(async () => {
	pb = await startPB({ METRICS_TEST_ROUTE: 'true' })
})

after(() => stopPB(pb))

const runSnapshot = () => api('POST', '/api/_test/run-metrics-snapshot', adminAuth())

async function createItem(ownerToken, owner, overrides = {}) {
	const r = await api('POST', '/api/collections/items/records', ownerToken, {
		name: 'MetricsItem',
		description: 'd',
		place: 'p',
		owner,
		trusteesOnly: false,
		status: 'available',
		...overrides,
	})
	assert.equal(r.status, 200, JSON.stringify(r.json))
	return r.json.id
}

async function createConversation(requesterToken, requester, itemOwner, requestedItem) {
	const r = await api('POST', '/api/collections/conversations/records', requesterToken, {
		requester,
		itemOwner,
		requestedItem,
		lendingStatus: 'pending',
	})
	assert.equal(r.status, 200, JSON.stringify(r.json))
	return r.json.id
}

const patchStatus = (convId, actorToken, lendingStatus, extra = {}) =>
	api('PATCH', `/api/collections/conversations/records/${convId}`, actorToken, {
		lendingStatus,
		...extra,
	})

test('test route requires superuser', async () => {
	const u = await makeUser('metricsauth')
	const asUser = await api('POST', '/api/_test/run-metrics-snapshot', u.t)
	assert.ok([401, 403].includes(asUser.status), 'regular user is rejected')
})

test('acceptedAt/completedAt: stamped once on first transition, then idempotent', async () => {
	const owner = await makeUser('mtsowner1')
	const requester = await makeUser('mtsreq1')
	const item = await createItem(owner.t, owner.id)
	const convId = await createConversation(requester.t, requester.id, owner.id, item)

	const accepted = await patchStatus(convId, owner.t, 'accepted')
	assert.equal(accepted.status, 200)
	const firstAcceptedAt = accepted.json.acceptedAt
	assert.ok(firstAcceptedAt, 'acceptedAt stamped on pending -> accepted')
	assert.equal(accepted.json.completedAt, '', 'completedAt untouched by an accept')

	// abort (frees the item) then re-accept — idempotent: acceptedAt must NOT move.
	const aborted = await patchStatus(convId, owner.t, 'aborted')
	assert.equal(aborted.status, 200)
	const reaccepted = await patchStatus(convId, owner.t, 'accepted')
	assert.equal(reaccepted.status, 200)
	assert.equal(reaccepted.json.acceptedAt, firstAcceptedAt, 're-accept keeps the FIRST acceptedAt')

	const completed = await patchStatus(convId, owner.t, 'completed')
	assert.equal(completed.status, 200)
	assert.ok(completed.json.completedAt, 'completedAt stamped on transition into completed')
	assert.equal(completed.json.acceptedAt, firstAcceptedAt, 'acceptedAt still unchanged')
})

test('acceptedAt cannot be forged by a client-supplied value', async () => {
	const owner = await makeUser('mtsowner2')
	const requester = await makeUser('mtsreq2')
	const item = await createItem(owner.t, owner.id)
	const convId = await createConversation(requester.t, requester.id, owner.id, item)

	// No real transition (still pending) — a forged acceptedAt must be discarded.
	const forged = await api('PATCH', `/api/collections/conversations/records/${convId}`, owner.t, {
		acceptedAt: '2000-01-01 00:00:00.000Z',
	})
	assert.equal(forged.status, 200)
	assert.equal(forged.json.acceptedAt, '', 'forged acceptedAt without a real transition is discarded')

	// Real transition WITH a forged value in the same request — hook wins, not the payload.
	const acceptedWithForgery = await api(
		'PATCH',
		`/api/collections/conversations/records/${convId}`,
		owner.t,
		{ lendingStatus: 'accepted', acceptedAt: '2000-01-01 00:00:00.000Z' }
	)
	assert.equal(acceptedWithForgery.status, 200)
	assert.notEqual(
		acceptedWithForgery.json.acceptedAt,
		'2000-01-01 00:00:00.000Z',
		'the hook-computed timestamp overrides a forged one, not the other way round'
	)
})

test('daily snapshot: computes core counts and upserts one row per day', async () => {
	const owner = await makeUser('mtsowner3')
	const requester = await makeUser('mtsreq3')
	const item = await createItem(owner.t, owner.id)
	const convId = await createConversation(requester.t, requester.id, owner.id, item)
	await patchStatus(convId, owner.t, 'accepted')
	await patchStatus(convId, owner.t, 'active')
	await patchStatus(convId, owner.t, 'return_requested')
	await patchStatus(convId, owner.t, 'completed')

	const first = await runSnapshot()
	assert.equal(first.status, 200)
	assert.deepEqual(
		first.json.groups.sort(),
		[
			'activeUsers',
			'community',
			'funnel',
			'impact',
			'integrations',
			'items',
			'loans',
			'messages',
			'outboundClicks',
			'users',
		].sort()
	)

	const rows1 = await api('GET', '/api/collections/metrics_daily/records?sort=-date&perPage=5', adminAuth())
	assert.equal(rows1.status, 200)
	assert.equal(rows1.json.items.length, 1, 'exactly one metrics_daily row exists')
	const row1 = rows1.json.items[0]
	assert.ok(row1.metrics.loans.byStatus.completed >= 1)
	assert.ok(row1.metrics.loans.completedTotal >= 1)
	assert.ok(row1.metrics.loans.accepted30d >= 1)
	assert.ok(row1.metrics.loans.completed30d >= 1)
	assert.ok(row1.metrics.items.available >= 1)
	assert.ok(row1.metrics.users.total >= 2)

	// Re-running the same day must upsert (same id), not create a second row.
	const second = await runSnapshot()
	assert.equal(second.status, 200)
	const rows2 = await api('GET', '/api/collections/metrics_daily/records?sort=-date&perPage=5', adminAuth())
	assert.equal(rows2.json.items.length, 1, 'still exactly one row after a second run')
	assert.equal(rows2.json.items[0].id, row1.id, 'the SAME row was updated, not a new one created')
})

test('outbound clicks are attributed to the clicked item\'s owner, not left unattributed', async () => {
	const owner = await makeUser('mtsowner4')
	const clicker = await makeUser('mtsclicker4')
	const item = await createItem(owner.t, owner.id)

	const click = await api('POST', '/api/collections/outbound_clicks/records', clicker.t, {
		destination: 'https://partner.example/x',
		source_page: 'item-detail',
		item,
	})
	assert.equal(click.status, 200, JSON.stringify(click.json))

	const snapshot = await runSnapshot()
	assert.equal(snapshot.status, 200)

	const rows = await api('GET', '/api/collections/metrics_daily/records?sort=-date&perPage=1', adminAuth())
	const byOwner = rows.json.items[0].metrics.outboundClicks.byItemOwner30d
	const ownerEntry = byOwner.find((e) => e.userId === owner.id)
	assert.ok(ownerEntry, 'the click is attributed to the item owner via the item relation')
	assert.ok(ownerEntry.count >= 1)
})

test('outbound clicks are grouped by destination domain, independent of item attribution', async () => {
	const clicker = await makeUser('mtsclicker5')

	await api('POST', '/api/collections/outbound_clicks/records', clicker.t, {
		destination: 'https://partner-a.example/artikel/1',
		source_page: 'item-detail',
	})
	await api('POST', '/api/collections/outbound_clicks/records', clicker.t, {
		destination: 'https://partner-a.example/artikel/2',
		source_page: 'search',
	})
	await api('POST', '/api/collections/outbound_clicks/records', clicker.t, {
		destination: 'https://PARTNER-B.example:8443/x',
		source_page: 'item-detail',
	})

	const snapshot = await runSnapshot()
	assert.equal(snapshot.status, 200)

	const rows = await api('GET', '/api/collections/metrics_daily/records?sort=-date&perPage=1', adminAuth())
	const byDomain = rows.json.items[0].metrics.outboundClicks.byDomain30d
	const a = byDomain.find((e) => e.domain === 'partner-a.example')
	const b = byDomain.find((e) => e.domain === 'partner-b.example')
	assert.ok(a, 'groups by hostname regardless of path')
	assert.equal(a.count, 2)
	assert.ok(b, 'lowercases the host and strips the port')
	assert.equal(b.count, 1)
})

test('users.isAdmin is invisible via the API and cannot be self-set', async () => {
	const alice = await makeUser('mtsadminflag1')
	const bob = await makeUser('mtsadminflag2')

	// Superuser flips alice to admin — the only supported way to grant it. The
	// superuser's OWN response shows the hidden field (superuser requests bypass
	// `hidden`) — that's exactly what $lib/server/metrics.ts's isAdmin() relies on.
	const grant = await api('PATCH', `/api/collections/users/records/${alice.id}`, adminAuth(), { isAdmin: true })
	assert.equal(grant.status, 200, JSON.stringify(grant.json))
	assert.equal(grant.json.isAdmin, true)

	// A regular user viewing their OWN row never sees the field either.
	const ownView = await api('GET', `/api/collections/users/records/${alice.id}`, alice.t)
	assert.equal(ownView.status, 200)
	assert.equal(ownView.json.isAdmin, undefined, 'hidden fields never serialize for non-superuser requests')

	// Nor can another authenticated user see it (the base users viewRule is broad).
	const otherView = await api('GET', `/api/collections/users/records/${alice.id}`, bob.t)
	assert.equal(otherView.status, 200)
	assert.equal(otherView.json.isAdmin, undefined)

	// A regular user cannot grant themselves admin via a self-update: the request
	// itself succeeds (other fields are still writable), but a write to a hidden
	// field from a non-superuser request is silently dropped rather than applied.
	const selfGrant = await api('PATCH', `/api/collections/users/records/${bob.id}`, bob.t, { isAdmin: true })
	assert.equal(selfGrant.status, 200)
	const afterSelfGrant = await api(
		'GET',
		`/api/collections/users/records/${bob.id}?fields=id,isAdmin`,
		adminAuth()
	)
	assert.equal(afterSelfGrant.json.isAdmin, false, 'the hidden-field write must be a no-op, not applied')

	// The superuser CAN read it when explicitly requested — this is what the
	// frontend's $lib/server/metrics.ts isAdmin() check relies on.
	const suView = await api(
		'GET',
		`/api/collections/users/records/${alice.id}?fields=id,isAdmin`,
		adminAuth()
	)
	assert.equal(suView.status, 200)
	assert.equal(suView.json.isAdmin, true, 'superuser requests see hidden fields')
})

test('acceptedAt/completedAt cannot be forged on create (no real transition ever happened)', async () => {
	const owner = await makeUser('mtscreate1')
	const requester = await makeUser('mtscreatereq1')
	const item = await createItem(owner.t, owner.id)

	// A normal pending create that also smuggles forged timestamps. onRecordUpdate never
	// fires on create, so the create-path guard is what has to discard these.
	const created = await api('POST', '/api/collections/conversations/records', requester.t, {
		requester: requester.id,
		itemOwner: owner.id,
		requestedItem: item,
		lendingStatus: 'pending',
		acceptedAt: '2000-01-01 00:00:00.000Z',
		completedAt: '2000-01-01 00:00:00.000Z',
	})
	assert.equal(created.status, 200, JSON.stringify(created.json))
	assert.equal(created.json.acceptedAt, '', 'forged acceptedAt on create is discarded')
	assert.equal(created.json.completedAt, '', 'forged completedAt on create is discarded')
})

test('a non-superuser cannot create a conversation already in a terminal state', async () => {
	const owner = await makeUser('mtscreate2')
	const requester = await makeUser('mtscreatereq2')
	const item = await createItem(owner.t, owner.id)

	// Attempt to seed a fake completed loan (would inflate loans.completed + the public
	// loansCompleted / impact numbers) straight from a direct API POST.
	const created = await api('POST', '/api/collections/conversations/records', requester.t, {
		requester: requester.id,
		itemOwner: owner.id,
		requestedItem: item,
		lendingStatus: 'completed',
		counterfactual: 'would_buy',
		completedAt: '2000-01-01 00:00:00.000Z',
	})
	assert.equal(created.status, 200, JSON.stringify(created.json))
	assert.equal(created.json.lendingStatus, 'pending', 'a non-superuser create is forced back to pending')
	assert.equal(created.json.completedAt, '', 'no completedAt is stamped for the forced-pending create')
	assert.equal(created.json.acceptedAt, '', 'no acceptedAt either')
})

test('a superuser may still create a conversation in a terminal state (seed/admin path)', async () => {
	const owner = await makeUser('mtscreate3')
	const requester = await makeUser('mtscreatereq3')
	const item = await createItem(owner.t, owner.id)

	const created = await api('POST', '/api/collections/conversations/records', adminAuth(), {
		requester: requester.id,
		itemOwner: owner.id,
		requestedItem: item,
		lendingStatus: 'completed',
	})
	assert.equal(created.status, 200, JSON.stringify(created.json))
	assert.equal(created.json.lendingStatus, 'completed', 'superuser create keeps the requested status')
	assert.ok(created.json.completedAt, 'completedAt is stamped for a superuser create-in-completed')
})
