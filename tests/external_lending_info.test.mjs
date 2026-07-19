// Issue #368 — externalLendingInfo is a per-institution "how the lending works" help text
// on the users record, surfaced to UNauthenticated item browsing via a masked items_public
// column (ownerExternalLendingInfo). This pins down:
//   1. ownerExternalLendingInfo carries the owner's value on a fully-public item.
//   2. It is masked (NULL) for a restricted item (trusteesOnly OR group-shared) — the same
//      masking the item's own content columns get.
//   3. Unlike ownerContact* (#438), there is NO contactPublic gate — it's a public help text.
//   4. The field never appears in users_public or items_searchable.
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { startPB, stopPB, makeUser, api, adminAuth } from './harness.mjs'

let pb

before(async () => {
	pb = await startPB()
})

after(() => stopPB(pb))

const INFO = 'So läuft die Ausleihe bei uns: vor Ort im Rathaus, mit eigenem Konto.'

test('items_public exposes ownerExternalLendingInfo on a fully-public item (#368)', async () => {
	const u = await makeUser('lendinginfo')
	// Set the info text on the owner's users record (admin, since it's a users field).
	assert.equal(
		(await api('PATCH', `/api/collections/users/records/${u.id}`, adminAuth(), {
			externalLendingInfo: INFO,
		})).status,
		200
	)

	const it = await api('POST', '/api/collections/items/records', u.t, {
		name: 'ExternesItem',
		description: 'd',
		place: 'p',
		owner: u.id,
		trusteesOnly: false,
		status: 'available',
	})
	assert.equal(it.status, 200)

	// Read via items_public — the column carries the owner's value even WITHOUT any
	// contactPublic opt-in (public help text, no PII gate).
	const row = await api('GET', `/api/collections/items_public/records/${it.json.id}`, adminAuth())
	assert.equal(row.status, 200)
	assert.equal(row.json.ownerExternalLendingInfo, INFO, 'public item: ownerExternalLendingInfo set')
})

test('items_public masks ownerExternalLendingInfo for restricted items (#368)', async () => {
	const u = await makeUser('lendinginfomask')
	assert.equal(
		(await api('PATCH', `/api/collections/users/records/${u.id}`, adminAuth(), {
			externalLendingInfo: INFO,
		})).status,
		200
	)

	// trustees-only item → masked.
	const trusted = await api('POST', '/api/collections/items/records', u.t, {
		name: 'TrustItem',
		description: 'd',
		place: 'p',
		owner: u.id,
		trusteesOnly: true,
		status: 'available',
	})
	assert.equal(trusted.status, 200)
	const trustedRow = await api('GET', `/api/collections/items_public/records/${trusted.json.id}`, adminAuth())
	assert.equal(trustedRow.json.ownerExternalLendingInfo, null, 'trustees-only: ownerExternalLendingInfo NULL')

	// group-shared item (trusteesOnly = false) → also masked.
	const g = await api('POST', '/api/collections/groups/records', u.t, { name: 'Verleih-Kreis', owner: u.id })
	assert.equal(g.status, 200)
	const grouped = await api('POST', '/api/collections/items/records', u.t, {
		name: 'GroupItem',
		description: 'd',
		place: 'p',
		owner: u.id,
		trusteesOnly: false,
		groups: [g.json.id],
		status: 'available',
	})
	assert.equal(grouped.status, 200)
	const groupedRow = await api('GET', `/api/collections/items_public/records/${grouped.json.id}`, adminAuth())
	assert.equal(groupedRow.json.ownerExternalLendingInfo, null, 'group-shared: ownerExternalLendingInfo NULL')
})

test('externalLendingInfo never appears in users_public or items_searchable (#368)', async () => {
	const u = await makeUser('lendinginfoleak')
	assert.equal(
		(await api('PATCH', `/api/collections/users/records/${u.id}`, adminAuth(), {
			externalLendingInfo: INFO,
		})).status,
		200
	)
	const it = await api('POST', '/api/collections/items/records', u.t, {
		name: 'LeakInfoItem',
		description: 'd',
		place: 'p',
		owner: u.id,
		trusteesOnly: false,
		status: 'available',
	})
	assert.equal(it.status, 200)

	// A view returns only the columns in its viewQuery SELECT, so admin reads are the
	// strictest check that the field simply isn't projected there.
	const usersPublic = await api('GET', `/api/collections/users_public/records/${u.id}`, adminAuth())
	assert.equal(usersPublic.status, 200, 'users_public row readable')
	assert.ok(
		!('externalLendingInfo' in usersPublic.json),
		'users_public must not expose externalLendingInfo'
	)
	assert.ok(
		!('ownerExternalLendingInfo' in usersPublic.json),
		'users_public must not expose ownerExternalLendingInfo'
	)

	const searchable = await api('GET', `/api/collections/items_searchable/records/${it.json.id}`, adminAuth())
	assert.equal(searchable.status, 200, 'items_searchable row readable')
	assert.ok(
		!('externalLendingInfo' in searchable.json),
		'items_searchable must not expose externalLendingInfo'
	)
	assert.ok(
		!('ownerExternalLendingInfo' in searchable.json),
		'items_searchable must not expose ownerExternalLendingInfo'
	)
})
