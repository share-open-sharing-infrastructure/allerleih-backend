// #607 one-click unsubscribe (GET/POST /api/unsubscribe/{purpose}/{token}) — services/unsubscribe.js
// + unsubscribe.pb.js. Tokens are stateless HMAC, so this file mints REAL tokens by actually
// running the weekly digest against an SMTP sink and pulling the List-Unsubscribe URL out of the
// sent mail (rather than adding a token-minting test-only route) — this also proves the token the
// digest actually issues round-trips correctly through the unsubscribe endpoint end to end.
//
// NOTE: the unsubscribe endpoint returns HTML, not JSON — harness.mjs's api() helper does
// JSON.parse() on every response body, so it CANNOT be used here (it would throw on an HTML
// response). This file talks to BASE directly with raw fetch() instead.
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { startPbWithSmtpSink, stopPB, makeUser, api, adminAuth, BASE, headerValue } from './harness.mjs'

let pb, sink, alice, bob, carol
let aliceToken, bobToken, carolToken

function tokenFromUnsubscribeHeader(raw) {
	const unsub = headerValue(raw, 'List-Unsubscribe')
	assert.ok(unsub, 'expected a List-Unsubscribe header')
	const match = unsub.match(/<https:\/\/backend\.example\.test\/api\/unsubscribe\/digest\/([^>]+)>/)
	assert.ok(match, `List-Unsubscribe header must contain a token (got: ${unsub})`)
	return match[1]
}

async function createPublicItem(owner, name) {
	const it = await api('POST', '/api/collections/items/records', adminAuth(), {
		name,
		description: 'd',
		place: 'p',
		owner: owner.id,
		status: 'available',
		trusteesOnly: false,
	})
	assert.equal(it.status, 200, JSON.stringify(it.json))
	return it.json.id
}

async function runDigest() {
	const run = await api('POST', '/api/_test/run-digest', adminAuth(), {})
	assert.equal(run.status, 200, JSON.stringify(run.json))
	return run.json
}

before(async () => {
	;({ pb, sink } = await startPbWithSmtpSink({
		DIGEST_TEST_ROUTE: 'true',
		UNSUBSCRIBE_SECRET: 'test-only-unsubscribe-secret-do-not-use-in-prod',
		FRONTEND_URL: 'https://fe.example.test',
		APP_URL: 'https://backend.example.test',
	}))

	alice = await makeUser('unsalice')
	bob = await makeUser('unsbob')
	carol = await makeUser('unscarol')

	// Each owns a public item so the OTHER two see something new and all three get a real digest
	// mail (a user never appears in their own digest).
	await createPublicItem(alice, 'UnsubTestItem-alice')
	await createPublicItem(bob, 'UnsubTestItem-bob')
	await createPublicItem(carol, 'UnsubTestItem-carol')

	const res = await runDigest()
	assert.equal(res.sent, 3, 'all three should receive a digest for the other two items')
	await new Promise((r) => setTimeout(r, 200))
	assert.equal(sink.messages.length, 3)

	const rawFor = (username) => sink.messages.find((m) => headerValue(m, 'To') === `${username}@test.local`)
	aliceToken = tokenFromUnsubscribeHeader(rawFor('unsalice'))
	bobToken = tokenFromUnsubscribeHeader(rawFor('unsbob'))
	carolToken = tokenFromUnsubscribeHeader(rawFor('unscarol'))
})

after(() => {
	stopPB(pb)
	sink.stop()
})

async function getUnsub(token, purpose = 'digest') {
	const res = await fetch(`${BASE}/api/unsubscribe/${purpose}/${token}`)
	return { status: res.status, text: await res.text() }
}

async function postUnsub(token, purpose = 'digest') {
	const res = await fetch(`${BASE}/api/unsubscribe/${purpose}/${token}`, { method: 'POST' })
	return { status: res.status, text: await res.text() }
}

async function prefsRowFor(userId) {
	const list = await api(
		'GET',
		`/api/collections/user_preferences/records?filter=${encodeURIComponent(`user = "${userId}"`)}`,
		adminAuth()
	)
	assert.equal(list.status, 200)
	return list.json.items[0] || null
}

test('GET with a valid token renders the confirm form and writes nothing', async () => {
	assert.equal(await prefsRowFor(alice.id), null, 'precondition: alice has no prefs row yet')

	const res = await getUnsub(aliceToken)
	assert.equal(res.status, 200)
	assert.match(res.text, /abbestellen/i)
	assert.match(res.text, /<form method="post"/)
	assert.ok(!res.text.includes(aliceToken), 'the token itself must never be echoed into the page')

	assert.equal(await prefsRowFor(alice.id), null, 'GET must not create a preferences row')
})

test('POST with a valid token unsubscribes: digestEmails=false, emailNotifications left true (row created)', async () => {
	const res = await postUnsub(aliceToken)
	assert.equal(res.status, 200)
	assert.match(res.text, /keinen Wochen-R/i)

	const row = await prefsRowFor(alice.id)
	assert.ok(row, 'a preferences row must now exist')
	assert.equal(row.digestEmails, false)
	// #607 B2: the digest-only unsubscribe must NOT also opt the user out of transactional mail.
	assert.equal(row.emailNotifications, true)
})

test('POST is idempotent — a second POST with the same token is still a 200 no-op', async () => {
	const res = await postUnsub(aliceToken)
	assert.equal(res.status, 200)

	const row = await prefsRowFor(alice.id)
	assert.equal(row.digestEmails, false)
	assert.equal(row.emailNotifications, true)
})

test('a user without an existing preferences row gets one created correctly on unsubscribe', async () => {
	assert.equal(await prefsRowFor(bob.id), null, 'precondition: bob has no prefs row yet')

	const res = await postUnsub(bobToken)
	assert.equal(res.status, 200)

	const row = await prefsRowFor(bob.id)
	assert.ok(row)
	assert.equal(row.digestEmails, false)
	assert.equal(row.emailNotifications, true)
})

test('an unknown purpose 404s and never reaches token verification', async () => {
	const res = await getUnsub(carolToken, 'newsletter')
	assert.equal(res.status, 404)
})

test('a tampered signature and a well-formed but bogus token get the SAME 400 response (no enumeration)', async () => {
	const tamperedLastChar = carolToken.slice(0, -1) + (carolToken.at(-1) === 'a' ? 'b' : 'a')
	const tampered = await getUnsub(tamperedLastChar)
	const bogus = await getUnsub(`${carol.id}.` + '0'.repeat(64))

	assert.equal(tampered.status, 400)
	assert.equal(bogus.status, 400)
	assert.equal(tampered.text, bogus.text, 'the two invalid-token responses must be byte-identical')
})

test('a malformed token (no signature at all) also 400s with the same body', async () => {
	const malformed = await getUnsub('not-a-real-token')
	const bogus = await getUnsub(`${carol.id}.` + '0'.repeat(64))
	assert.equal(malformed.status, 400)
	assert.equal(malformed.text, bogus.text)
})

test('a token for a user that no longer exists gets the SAME 400 response as a bad signature', async () => {
	const gone = await makeUser('unsgone')
	const other = await makeUser('unsother')
	// `gone` deliberately owns nothing — hard-deleting a user who owns an item is blocked by the
	// items.owner required relation (a separate, unrelated constraint); only `other` needs an
	// item so `gone` has something new to see and gets a real digest + token.
	await createPublicItem(other, 'UnsubOtherItem')

	const before = sink.messages.length
	await runDigest()
	await new Promise((r) => setTimeout(r, 200))

	const goneEmail = `${gone.username}@test.local`
	const goneRaw = sink.messages.slice(before).find((m) => headerValue(m, 'To') === goneEmail)
	assert.ok(goneRaw, 'gone user must have received a digest (sees the other-owned item)')
	const goneToken = tokenFromUnsubscribeHeader(goneRaw)

	// Hard-delete the user the token was minted for; the signature is still valid, only the
	// user no longer exists.
	const del = await api('DELETE', `/api/collections/users/records/${gone.id}`, adminAuth())
	assert.ok([200, 204].includes(del.status), JSON.stringify(del.json))

	const staleTokenRes = await getUnsub(goneToken)
	const bogusRes = await getUnsub(`${gone.id}.` + '0'.repeat(64))
	assert.equal(staleTokenRes.status, 400)
	assert.equal(staleTokenRes.text, bogusRes.text, 'a token for a deleted user must not be distinguishable from a bad signature')
})
