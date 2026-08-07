// #622 "Digest item thumbnails are dead links (404)" — proves the actual URL that lands in a
// recipient's inbox resolves to a real image, not just that the string is well-formed.
//
// Own PB instance (not folded into mail-deliverability.test.mjs) because that file deliberately
// points APP_URL at an unreachable https://backend.example.test — the right choice for asserting
// URL SHAPE, but useless here: we need to `fetch()` the `<img src>` verbatim, so APP_URL must be
// this harness's own reachable base URL. assetBase() (pb_hooks/utils/urls.js) honours an
// explicitly-set APP_URL unconditionally — including a loopback host — as step 1 of its
// documented resolution order, so pointing it at BASE (http://127.0.0.1:8091) works.
//
// NOTE on what this file deliberately does NOT cover: a genuinely trustees-only item that lands in
// the digest's "trusted" section. Verified empirically while building this test: jobs/digest.js's
// categorizeItemsForUser()/fetchDigestInputs() read `user.get('trusts')` on real `users` records,
// but that field was DROPPED in favor of a dedicated `trusts` join collection (`truster`/
// `trustee`) back on main (8cb895e "feat(trust): replace users.trusts[] with a trusts join
// collection") — `.get('trusts')` is therefore always undefined/empty, so a trustees-only item can
// never pass the digest's own visibility gate for ANY recipient today, regardless of real trust
// state. This is a separate, pre-existing, out-of-scope bug (confirmed independently: the existing
// tests/digest-visibility.test.mjs, unmodified by #622, already fails two cases on this exact
// branch — "owner trusting viewer DOES grant access" and "trust is one-way" — both expect 200 and
// get 404). Fails CLOSED, not a leak. #622 must not silently fix this in a thumbnail-URL PR; it's
// flagged for a dedicated follow-up. The group-item fixture below is unaffected — group membership
// still resolves through the real, working `group_members` collection — so it alone gives a
// genuine, non-vacuous negative test for AC 2.
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import {
	startPbWithSmtpSink,
	stopPB,
	makeUser,
	api,
	adminAuth,
	BASE,
	extractPart,
	decodeQuotedPrintable,
	waitForMessageCount,
} from './harness.mjs'

let pb, sink, owner, recipient, publicItem, groupItem, trusteesOnlyItem, publicFilename
// Populated once in before() — the digest is run exactly once for the whole file (not once per
// test) and every test below asserts against that SAME resulting mail. This also avoids an
// implicit ordering dependency between tests: nothing here relies on a PRIOR TEST having run,
// only on before()'s own setup, so the four tests below are independently runnable in any order.
let digestHtml, fileUrls

// A real, decodable 1x1 transparent PNG — matters so `?thumb=0x300` generation exercises actual
// resize logic rather than silently falling back to serving the (untouched) original.
const PNG_1PX_BASE64 =
	'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII='

/**
 * There is no file-upload helper in the harness — `api()` hardcodes `Content-Type: application/
 * json`. Local to this file (one consumer): builds a real multipart/form-data request with NO
 * manually-set Content-Type header (fetch derives the multipart boundary itself; setting it
 * manually loses the boundary and PocketBase can't parse the body).
 *
 * Uses adminAuth() (superuser — bypasses collection API rules) so `owner` can be set directly to
 * any user id in one request, same pattern as digest.test.mjs's/digest-visibility.test.mjs's item
 * fixtures.
 */
async function createItemWithImage({ name, ownerId, trusteesOnly = false, groups = [] }) {
	const png = Buffer.from(PNG_1PX_BASE64, 'base64')
	const form = new FormData()
	form.append('name', name)
	form.append('description', 'test')
	form.append('place', 'somewhere')
	form.append('owner', ownerId)
	form.append('status', 'available')
	form.append('trusteesOnly', String(trusteesOnly))
	for (const groupId of groups) form.append('groups', groupId)
	form.append('image', new Blob([png], { type: 'image/png' }), 'test.png')

	const res = await fetch(BASE + '/api/collections/items/records', {
		method: 'POST',
		headers: { Authorization: adminAuth() },
		body: form,
	})
	const json = await res.json()
	if (res.status !== 200) throw new Error('createItemWithImage failed: ' + JSON.stringify(json))
	return json
}

before(async () => {
	;({ pb, sink } = await startPbWithSmtpSink({
		DIGEST_TEST_ROUTE: 'true',
		FRONTEND_URL: 'https://fe.example.test',
		APP_URL: BASE,
	}))

	owner = await makeUser('imgowner')
	recipient = await makeUser('imgrecipient')

	const group = await api('POST', '/api/collections/groups/records', adminAuth(), {
		name: 'ImageDigestGroup',
		owner: owner.id,
	})
	assert.equal(group.status, 200, JSON.stringify(group.json))
	const groupMember = await api('POST', '/api/collections/group_members/records', adminAuth(), {
		group: group.json.id,
		user: recipient.id,
	})
	assert.equal(groupMember.status, 200, JSON.stringify(groupMember.json))

	publicItem = await createItemWithImage({ name: 'PublicSectionItem', ownerId: owner.id })
	groupItem = await createItemWithImage({
		name: 'GroupSectionItem',
		ownerId: owner.id,
		groups: [group.json.id],
	})
	// Deliberately NO trust edge at all — see the file-level doc comment on why a genuinely
	// trustees-only item can't be exercised through the digest today. This fixture exists solely
	// for the standalone file-serving characterisation test below: the point that assertion makes
	// is stronger without any trust grant in place at all — the file is reachable even though
	// NOTHING has authorized the recipient to see this item's record.
	trusteesOnlyItem = await createItemWithImage({ name: 'TrusteesOnlyItem', ownerId: owner.id, trusteesOnly: true })
	publicFilename = Array.isArray(publicItem.image) ? publicItem.image[0] : publicItem.image

	// Run the digest ONCE here — every test below reads the SAME resulting mail, so this is hoisted
	// rather than re-triggered per test (which would also quadruple digest sends and complicate
	// "find the digest mail among whatever this run sent" bookkeeping across tests).
	const beforeCount = sink.messages.length
	const run = await api('POST', '/api/_test/run-digest', adminAuth(), {})
	assert.equal(run.status, 200, JSON.stringify(run.json))
	assert.ok(run.json.sent >= 1, 'the recipient should receive a digest for the owner-created items')
	await waitForMessageCount(sink, beforeCount + 1)

	const digestRaw = sink.messages.slice(beforeCount).find((m) => /Wochen-R=C3=BCckblick|Wochen-Rückblick/.test(m))
	assert.ok(digestRaw, 'a weekly-digest mail must have been sent')

	digestHtml = decodeQuotedPrintable(extractPart(digestRaw, 'text/html'))

	// Extract every <img src="...">, then narrow to file-served ones — the mail layout's own logo
	// (`{{.ASSET_URL}}/AllerLeih.png`) also has a src= but never contains "/api/files/".
	const allImgSrcs = [...digestHtml.matchAll(/<img[^>]+src="([^"]*)"/g)].map((m) => m[1])
	fileUrls = allImgSrcs.filter((src) => src.includes('/api/files/'))

	// Splitting the original single test into four made the later ones able to pass vacuously if
	// the digest ever emitted NO file URL at all (`[].some(...)` is false, and `fileUrls[0]` would
	// be undefined). Assert the precondition once, here, so that regression fails loudly in the
	// hook rather than as an opaque TypeError three tests later.
	assert.ok(fileUrls.length > 0, 'sanity: the digest must have produced at least one file URL')
})

after(() => {
	stopPB(pb)
	sink.stop()
})

test('digest thumbnail URL resolves to items_searchable with the whitelisted thumb, never items_public (#622)', async () => {
	assert.equal(
		fileUrls.length,
		1,
		'exactly one file-served image URL must appear in the digest (the public item only — see below)'
	)
	assert.equal(
		fileUrls[0],
		`${BASE}/api/files/items_searchable/${publicItem.id}/${publicFilename}?thumb=0x300`,
		'#622: must be items_searchable (a real file column), never items_public (masked to json — 404), and must carry the whitelisted thumb size'
	)

	// --- Regression anchor: pin the bug in place. If a future edit reverts items_searchable back
	// to items_public, this must start failing. ---
	const revertedToPublicView = fileUrls[0].replace('items_searchable', 'items_public')
	const rReverted = await fetch(revertedToPublicView)
	assert.equal(
		rReverted.status,
		404,
		'items_public cannot serve files at all (image column is a masking expression PocketBase types as json) — this is the #622 bug this fix moved away from'
	)
})

test('the resolved thumbnail URL is stable across a refetch (thumb cache) and serves real image bytes', async () => {
	// --- The URL that actually lands in the inbox must resolve, unauthenticated, with real image
	// bytes. ---
	const rGood = await fetch(fileUrls[0])
	assert.equal(rGood.status, 200)
	assert.match(rGood.headers.get('content-type') || '', /^image\//, 'must be served as an image, not JSON/an error page')
	const bytes = await rGood.arrayBuffer()
	assert.ok(bytes.byteLength > 0, 'the thumbnail must have non-zero length')

	// Fetch again — thumb generation/caching must not be a one-shot fluke. A literal "days later"
	// expiry test isn't constructible in an integration test; the real guarantee here is
	// structural, not temporal — the URL carries no token and no expiry parameter at all (see the
	// doc comment above the image-resolution block in jobs/digest.js), so there is nothing in the
	// URL that COULD expire.
	const rGoodAgain = await fetch(fileUrls[0])
	assert.equal(rGoodAgain.status, 200, 'the same URL must still resolve on a second fetch (thumb cache)')
})

test('group item never exposes a file URL despite having an uploaded image (AC 2)', () => {
	// --- AC 2, at the mail level: the group item must never expose a file URL (its section
	// renders with allowUploadedImages=false), even though it also has a real uploaded image —
	// proving the restriction is enforced deliberately, not "trivially true because there was
	// nothing to leak". It must still appear in the mail as a title/link, so this isn't vacuously
	// green because the section was empty. (The trustees-only fixture is intentionally NOT part of
	// this assertion — see the file-level doc comment on why it can't currently reach the digest at
	// all.) ---
	assert.ok(
		!fileUrls.some((url) => url.includes(groupItem.id)),
		"the group item's id must never appear in a file URL, despite having a real uploaded image"
	)
	assert.ok(digestHtml.includes('GroupSectionItem'), 'the group item must still appear in the mail (title/link)')
})

test("trustees-only item's file is reachable unauthenticated regardless of trust (characterisation)", async () => {
	// --- Characterisation, NOT a guarantee: PocketBase's file-serving endpoint evaluates no
	// collection view rule (and no trust check) at all — only the field's `protected` flag (false
	// here) — so a trustees-only item's own uploaded file is equally reachable, unauthenticated, by
	// anyone who knows the URL (empirically verified while building #622; `trusteesOnlyItem` above
	// has no trust edge whatsoever, which makes the point sharper, not weaker: this is not "reachable
	// because trust was granted", it is reachable regardless). The barrier that keeps it out of the
	// digest for non-public items is `allowUploadedImages` in jobs/digest.js, NOT the server. Do not
	// "fix" this into an expected 403/404 — that would misdiagnose where the real guardrail lives
	// and could break the same file-serving behaviour the rest of the platform relies on. ---
	const trusteesOnlyFilename = Array.isArray(trusteesOnlyItem.image) ? trusteesOnlyItem.image[0] : trusteesOnlyItem.image
	const rTrusteesFile = await fetch(`${BASE}/api/files/items_searchable/${trusteesOnlyItem.id}/${trusteesOnlyFilename}`)
	assert.equal(
		rTrusteesFile.status,
		200,
		"characterisation: the file API does not enforce items_searchable's view rule (or trust), only the protected flag"
	)
})
