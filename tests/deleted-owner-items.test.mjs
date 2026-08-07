// Issue #624 — items of an anonymized (deleted = true) owner must stay out of discovery.
//
// Self-service deletion keeps an item that a conversation still references (
// conversations.requestedItem is a required relation) and only flips it to `unavailable`, so
// such rows genuinely exist. 1781900042_item_views_hide_deleted_owners.js appended
// `WHERE COALESCE(users.deleted, 0) = 0` to both item views to hide them. Four later migrations
// then reassigned `viewQuery` without carrying the clause over — 1781900045 for
// items_searchable, then 1781900049 -> 1782750000 -> 1783800001 for items_public — putting a
// deleted account's listings back into the guest catalogue and into search.
// 1785666606_item_views_restore_deleted_owner_filter.js restores the clause.
//
// This suite pins both halves of that trade-off and guards the regression:
//   1. the item disappears from items_public + items_searchable (even for a superuser read,
//      which bypasses the collection rules but not the view's SQL WHERE),
//   2. the conversation counterparty still resolves the item from the base `items` collection,
//   3./4. the clause is present in each view's live viewQuery — so the next wholesale rewrite
//      fails here instead of quietly re-opening the hole.
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { startPB, stopPB, makeUser, api, adminAuth } from './harness.mjs'

let pb, owner, borrower, itemId, convId

// The whole arrangement — up to and including the deletion — lives here, so every test below is
// pure act/assert and stays runnable on its own (--test-name-pattern, .only, reordering). A
// broken setup then fails as a setup failure instead of a misleading 404 on `undefined`.
before(async () => {
	pb = await startPB()
	owner = await makeUser('delowner')
	borrower = await makeUser('delborrower')

	// A plain public item — nothing about trust/group masking is under test here.
	const it = await api('POST', '/api/collections/items/records', owner.t, {
		name: 'Konversations-Item',
		description: 'd',
		place: 'p',
		owner: owner.id,
		trusteesOnly: false,
		status: 'available',
	})
	assert.equal(it.status, 200, 'item created')
	itemId = it.json.id

	// The conversation is what forces the item to survive the owner's deletion.
	const conv = await api('POST', '/api/collections/conversations/records', borrower.t, {
		requester: borrower.id,
		itemOwner: owner.id,
		requestedItem: itemId,
	})
	assert.equal(conv.status, 200, 'conversation created')
	convId = conv.json.id

	// Pre-assertions: without these the exclusion assertions could pass vacuously.
	assert.equal(
		(await api('GET', `/api/collections/items_public/records/${itemId}`)).status,
		200,
		'before deletion: guest sees the item in items_public'
	)
	assert.equal(
		(await api('GET', `/api/collections/items_searchable/records/${itemId}`, borrower.t)).status,
		200,
		'before deletion: the borrower finds the item in items_searchable'
	)

	// makeUser's password is test1234; the DELETE hook re-authenticates before erasing.
	const del = await api('DELETE', '/api/account', owner.t, { password: 'test1234' })
	assert.equal(del.status, 200, 'owner self-deletion succeeds')

	const ownerRow = await api('GET', `/api/collections/users/records/${owner.id}`, adminAuth())
	assert.equal(ownerRow.json.deleted, true, 'owner row anonymized')

	// The precondition for every test below: the item was RETAINED, not deleted.
	const base = await api('GET', `/api/collections/items/records/${itemId}`, adminAuth())
	assert.equal(base.status, 200, 'conversation-referenced item survives the deletion')
	assert.equal(base.json.status, 'unavailable', 'retained item is marked unavailable')
})

after(() => stopPB(pb))

test("a deleted owner's conversation-retained item vanishes from items_public and items_searchable (#624)", async () => {
	// Gone from the guest catalogue…
	assert.equal(
		(await api('GET', `/api/collections/items_public/records/${itemId}`)).status,
		404,
		'guest: items_public getOne 404s for a deleted owner'
	)
	const publicList = await api(
		'GET',
		`/api/collections/items_public/records?filter=${encodeURIComponent(`id="${itemId}"`)}`
	)
	assert.equal(publicList.json.totalItems, 0, 'guest: items_public list excludes the row')

	// …and from search, for the very user who is party to the conversation.
	assert.equal(
		(await api('GET', `/api/collections/items_searchable/records/${itemId}`, borrower.t)).status,
		404,
		'borrower: items_searchable getOne 404s for a deleted owner'
	)
	const searchList = await api(
		'GET',
		`/api/collections/items_searchable/records?filter=${encodeURIComponent(`id="${itemId}"`)}`,
		borrower.t
	)
	assert.equal(searchList.json.totalItems, 0, 'borrower: items_searchable list excludes the row')

	// The sharpest assertion: a superuser bypasses the collection rules but NOT the view's SQL
	// WHERE, so a 404 here proves the row is filtered out by the query, not merely hidden.
	assert.equal(
		(await api('GET', `/api/collections/items_public/records/${itemId}`, adminAuth())).status,
		404,
		'superuser: the row is absent from items_public itself, not just rule-hidden'
	)
	assert.equal(
		(await api('GET', `/api/collections/items_searchable/records/${itemId}`, adminAuth())).status,
		404,
		'superuser: the row is absent from items_searchable itself, not just rule-hidden'
	)
})

test('the conversation counterparty still reads the item from the base items collection (#624)', async () => {
	// The intended trade-off: discovery is gone, the conversation stays intact.
	const c = await api(
		'GET',
		`/api/collections/conversations/records/${convId}?expand=requestedItem`,
		borrower.t
	)
	assert.equal(c.status, 200, 'borrower can still read the conversation')
	assert.equal(c.json.expand?.requestedItem?.id, itemId, 'requestedItem still expands')
})

// Guard against the actual #624 regression mechanism: a migration that assigns a whole new
// viewQuery and forgets to carry the clause over. Tolerant of whitespace and of folding the
// clause into a compound `WHERE … AND …`, strict about the clause being there at all. It does
// NOT prove the clause is in force — it could be present but inert (folded into an `OR` branch,
// say); the behavioural assertions above are the load-bearing check. This regex exists to name
// the repair when a wholesale rewrite drops the clause outright.
const DELETED_OWNER_CLAUSE = /WHERE[\s\S]*COALESCE\(\s*users\.deleted\s*,\s*0\s*\)\s*=\s*0/
const REPAIR =
	'a later migration replaced `viewQuery` wholesale and dropped the deleted-owner filter — ' +
	're-append `WHERE COALESCE(users.deleted, 0) = 0`, see ' +
	'`pb_migrations/1785666606_item_views_restore_deleted_owner_filter.js` (#624)'

for (const view of ['items_public', 'items_searchable']) {
	test(`${view}: viewQuery still carries the deleted-owner filter (#624)`, async () => {
		const res = await api('GET', `/api/collections/${view}`, adminAuth())
		assert.equal(res.status, 200, `fetch ${view} schema`)
		assert.match(res.json.viewQuery, DELETED_OWNER_CLAUSE, `${view}: ${REPAIR}`)
	})
}
