// #607 weekly digest job (jobs/digest.js) — triggered via POST /api/_test/run-digest
// (DIGEST_TEST_ROUTE=true; cron schedules can't be fired on demand, same pattern as
// retention.pb.js's RETENTION_TEST_ROUTE). Own PB instance via startPbWithSmtpSink() (real SMTP
// sink rather than falling back to a likely-absent local sendmail; DIGEST_PACING_MS/
// DIGEST_BATCH_*=0 so the run is instant).
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { startPbWithSmtpSink, stopPB, makeUser, api, adminAuth } from './harness.mjs'

let pb, sink, alice, bob, carol, dave

before(async () => {
	;({ pb, sink } = await startPbWithSmtpSink({
		DIGEST_TEST_ROUTE: 'true',
		FRONTEND_URL: 'https://fe.example.test',
		APP_URL: 'https://backend.example.test',
	}))

	alice = await makeUser('digalice') // no prefs row at all -> opted in by default
	bob = await makeUser('digbob') // emailNotifications=false -> master opt-out
	carol = await makeUser('digcarol') // digestEmails=false only -> digest-only opt-out
	dave = await makeUser('digdave') // owns the only item -> sees nothing in their own digest

	const bobPrefs = await api('POST', '/api/collections/user_preferences/records', adminAuth(), {
		user: bob.id,
		emailNotifications: false,
		digestEmails: true,
	})
	assert.equal(bobPrefs.status, 200, JSON.stringify(bobPrefs.json))

	const carolPrefs = await api('POST', '/api/collections/user_preferences/records', adminAuth(), {
		user: carol.id,
		emailNotifications: true,
		digestEmails: false,
	})
	assert.equal(carolPrefs.status, 200, JSON.stringify(carolPrefs.json))

	const item = await api('POST', '/api/collections/items/records', adminAuth(), {
		name: 'DigestJobTestItem',
		description: 'd',
		place: 'p',
		owner: dave.id,
		status: 'available',
		trusteesOnly: false,
	})
	assert.equal(item.status, 200, JSON.stringify(item.json))
})

after(() => {
	stopPB(pb)
	sink.stop()
})

test('digestEmails=false skips the digest even though emailNotifications is true', async () => {
	const run = await api('POST', '/api/_test/run-digest', adminAuth(), {})
	assert.equal(run.status, 200, JSON.stringify(run.json))

	// alice: no prefs row (opted in by default) sees dave's item -> sent.
	// bob + carol: opted out (master switch / digest-only) -> both counted as skippedOptOut.
	// dave: owns the only item -> excluded via "nothing relevant to show", not an opt-out skip.
	assert.equal(run.json.sent, 1, 'only alice should receive the digest')
	assert.equal(run.json.skippedOptOut, 2, 'bob (master opt-out) and carol (digest-only opt-out) are both skipped')
	assert.equal(run.json.failed, 0)
	assert.equal(run.json.newItems, 1)
})

test('a missing preferences row means opted in (no row for alice, and she still received it)', async () => {
	const list = await api(
		'GET',
		`/api/collections/user_preferences/records?filter=${encodeURIComponent(`user = "${alice.id}"`)}`,
		adminAuth()
	)
	assert.equal(list.status, 200)
	assert.equal(list.json.totalItems, 0, 'alice never had a preferences row created for her')
})

test("an owner's own item never appears in their own digest — dave gets nothing and isn't counted as opted out", async () => {
	// Re-run: dave still owns the only item and nobody else added anything new, so dave has
	// nothing to see and must be silently excluded (not sent, not skippedOptOut, not failed).
	const run = await api('POST', '/api/_test/run-digest', adminAuth(), {})
	assert.equal(run.status, 200)
	assert.equal(run.json.sent, 1, 'still only alice')
	assert.equal(run.json.skippedOptOut, 2, 'still bob + carol')
})
