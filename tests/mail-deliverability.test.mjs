// #607 mail deliverability — end-to-end wire-format assertions against a real SMTP sink (no
// AUTH/STARTTLS — spike S3 confirmed PocketBase's mailer completes a full send against such a
// server when SMTP_USERNAME is empty). Own PB instance via startPbWithSmtpSink() + extra env
// (DIGEST_TEST_ROUTE + RETENTION_TEST_ROUTE so the cron bodies can be triggered on demand — cron
// schedules can't be fired directly), same pattern as retention-warning.test.mjs.
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import {
	startPbWithSmtpSink,
	stopPB,
	makeUser,
	api,
	adminAuth,
	headerValue,
	extractPart,
	decodeQuotedPrintable,
	waitForMessageCount,
} from './harness.mjs'

let pb, sink, alice, bob

const FRONTEND_URL = 'https://fe.example.test'
const APP_URL = 'https://backend.example.test'
const DIGEST_SENDER_ADDRESS = 'digest@example.test'
const DIGEST_SENDER_NAME = 'AllerLeih Digest'
const SENDER_ADDRESS = 'noreply@example.test'

before(async () => {
	;({ pb, sink } = await startPbWithSmtpSink({
		DIGEST_TEST_ROUTE: 'true',
		RETENTION_TEST_ROUTE: 'true',
		FRONTEND_URL,
		APP_URL,
		SENDER_ADDRESS,
		SENDER_NAME: 'AllerLeih Test',
		DIGEST_SENDER_ADDRESS,
		DIGEST_SENDER_NAME,
	}))
	alice = await makeUser('mdalice')
	bob = await makeUser('mdbob')
})

after(() => {
	stopPB(pb)
	sink.stop()
})

test('new-message mail: multipart/alternative, non-empty text/plain, no List-Unsubscribe, transactional sender, Auto-Submitted', async () => {
	const before = sink.messages.length
	const msg = await api('POST', '/api/collections/messages/records', adminAuth(), {
		from: bob.id,
		to: alice.id,
		messageContent: 'Hallo!',
	})
	assert.equal(msg.status, 200, JSON.stringify(msg.json))
	await waitForMessageCount(sink, before + 1)

	const raw = sink.messages[sink.messages.length - 1]
	assert.match(raw, /Content-Type: multipart\/alternative/i)
	const text = extractPart(raw, 'text/plain')
	assert.ok(text && text.trim().length > 0, 'text/plain part must be present and non-empty')
	assert.ok(!/List-Unsubscribe/i.test(raw), 'transactional mail must not carry List-Unsubscribe')
	assert.match(raw, /Auto-Submitted:\s*auto-generated/i)
	assert.match(raw, /X-Auto-Response-Suppress:\s*OOF, ?AutoReply/i)
	assert.match(headerValue(raw, 'From'), new RegExp(`AllerLeih Test.*<${SENDER_ADDRESS}>`))
	assert.ok(!raw.includes('allerleih.org'), 'no hard-coded allerleih.org literal must remain')

	const html = decodeQuotedPrintable(extractPart(raw, 'text/html'))
	// #607 B1: the logo path must be ASSET_URL + "/AllerLeih.png" — exactly one separating slash.
	assert.match(html, new RegExp(`${APP_URL}/AllerLeih\\.png`))
	assert.ok(!html.includes(`${APP_URL}//AllerLeih.png`), 'logo URL must not have a doubled slash')
})

test('weekly digest mail: multipart/alternative, List-Unsubscribe (One-Click), Precedence: bulk, digest sender identity', async () => {
	const item = await api('POST', '/api/collections/items/records', adminAuth(), {
		name: 'DeliverabilityTestItem',
		description: 'test',
		place: 'somewhere',
		owner: bob.id,
		status: 'available',
		trusteesOnly: false,
	})
	assert.equal(item.status, 200, JSON.stringify(item.json))

	const before = sink.messages.length
	const run = await api('POST', '/api/_test/run-digest', adminAuth(), {})
	assert.equal(run.status, 200, JSON.stringify(run.json))
	assert.ok(run.json.sent >= 1, 'at least alice should receive a digest for bobs new public item')
	await waitForMessageCount(sink, before + run.json.sent)

	// Find the digest mail among whatever was sent in this run (alice is the only guaranteed
	// recipient — bob owns the only new item, so it never appears in bob's own digest).
	const digestRaw = sink.messages.slice(before).find((m) => /Wochen-R=C3=BCckblick|Wochen-Rückblick/.test(m))
	assert.ok(digestRaw, 'a weekly-digest mail must have been sent')

	assert.match(digestRaw, /Content-Type: multipart\/alternative/i)
	const text = extractPart(digestRaw, 'text/plain')
	assert.ok(text && text.trim().length > 0, 'text/plain part must be present and non-empty')

	const unsubHeader = headerValue(digestRaw, 'List-Unsubscribe')
	assert.ok(unsubHeader, 'digest mail must carry List-Unsubscribe')
	assert.match(unsubHeader, /^<https:\/\/backend\.example\.test\/api\/unsubscribe\/digest\/.+>$/)
	assert.equal(headerValue(digestRaw, 'List-Unsubscribe-Post'), 'List-Unsubscribe=One-Click')
	assert.equal(headerValue(digestRaw, 'Precedence'), 'bulk')
	assert.match(headerValue(digestRaw, 'From'), new RegExp(`${DIGEST_SENDER_NAME}.*<${DIGEST_SENDER_ADDRESS}>`))
	assert.ok(!digestRaw.includes('allerleih.org'), 'no hard-coded allerleih.org literal must remain')
})

test('retention inactivity-warning mail: no List-Unsubscribe, transactional sender', async () => {
	const inactive = await makeUser('mdinactive')
	await api('PATCH', `/api/collections/users/records/${inactive.id}`, adminAuth(), {
		lastLoginAt: '2020-01-01 00:00:00.000Z',
	})

	const before = sink.messages.length
	const run = await api('POST', '/api/_test/run-retention/inactive-warnings', adminAuth(), {
		cutoff: '2021-01-01 00:00:00.000Z',
	})
	assert.equal(run.status, 200, JSON.stringify(run.json))
	assert.ok(run.json.warned >= 1)
	await waitForMessageCount(sink, before + 1)

	const raw = sink.messages[sink.messages.length - 1]
	assert.ok(!/List-Unsubscribe/i.test(raw), 'retention mail must not offer List-Unsubscribe (see #607 plan 2.9)')
	assert.match(headerValue(raw, 'From'), new RegExp(`AllerLeih Test.*<${SENDER_ADDRESS}>`))
	assert.ok(!raw.includes('allerleih.org'), 'no hard-coded allerleih.org literal must remain')

	const html = decodeQuotedPrintable(extractPart(raw, 'text/html'))
	assert.match(html, new RegExp(`${FRONTEND_URL}/auth/login`), 'login link must point at the FRONTEND host (#607 B1), not the backend')
})
