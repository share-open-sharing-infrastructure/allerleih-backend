// Issue #461 — automated GDPR data-retention jobs. The cron schedules themselves
// can't be fired on demand, so the harness starts PocketBase with
// RETENTION_TEST_ROUTE=true and the tests drive the job functions through the
// guarded POST /api/_test/run-retention/{job} route, passing an explicit cutoff
// (autodate columns like `created` can't be backdated via the API; a future cutoff
// makes "just created" records count as expired, a past cutoff proves retention).
// DRY_MODE=true keeps the skip-notice mails from attempting real SMTP.
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { startPB, stopPB, makeUser, api, adminAuth } from './harness.mjs'

let pb

before(async () => {
	// Small page size so the keyset-pagination loop runs multiple times even with a
	// handful of records (cf. GROUP_FIXUP_PAGE).
	pb = await startPB({ RETENTION_TEST_ROUTE: 'true', DRY_MODE: 'true', RETENTION_PAGE_SIZE: '2' })
})

after(() => stopPB(pb))

const PAST_CUTOFF = '2000-01-01 00:00:00.000Z' // nothing is older than this
const FUTURE_CUTOFF = '2099-01-01 00:00:00.000Z' // everything is older than this
const BACKDATED_LOGIN = '2020-01-01 00:00:00.000Z'
const INACTIVE_CUTOFF = '2021-01-01 00:00:00.000Z' // between BACKDATED_LOGIN and now

const runJob = (job, cutoff) => api('POST', `/api/_test/run-retention/${job}`, adminAuth(), { cutoff })

const createItem = async (owner) => {
	const r = await api('POST', '/api/collections/items/records', adminAuth(), {
		name: 'RetentionItem',
		description: 'd',
		place: 'p',
		owner,
		trusteesOnly: false,
		status: 'available',
	})
	assert.equal(r.status, 200)
	return r.json.id
}

test('test route requires superuser and validates input', async () => {
	const u = await makeUser('retauth')

	// makeUser authenticates, so the onRecordAuthRequest hook must have stamped a login.
	const row = await api('GET', `/api/collections/users/records/${u.id}`, adminAuth())
	assert.ok(row.json.lastLoginAt, 'lastLoginAt stamped on authentication')

	const asUser = await api('POST', '/api/_test/run-retention/feedback', u.t, { cutoff: PAST_CUTOFF })
	assert.ok([401, 403].includes(asUser.status), 'regular user is rejected')

	const unknown = await runJob('nonsense', PAST_CUTOFF)
	assert.equal(unknown.status, 404, 'unknown job -> 404')

	const noCutoff = await api('POST', '/api/_test/run-retention/feedback', adminAuth(), {})
	assert.equal(noCutoff.status, 400, 'missing cutoff -> 400')
})

test('notifications: purged after the window, retained inside it, idempotent', async () => {
	const u = await makeUser('retnotif')
	const created = await api('POST', '/api/collections/notifications/records', adminAuth(), {
		recipient: u.id,
		type: 'new_message',
		relatedId: 'someconversation',
		body: 'Test',
		read: false,
	})
	assert.equal(created.status, 200)
	const id = created.json.id

	const keep = await runJob('notifications', PAST_CUTOFF)
	assert.equal(keep.status, 200)
	assert.equal(keep.json.deleted, 0, 'nothing predates the past cutoff')
	assert.equal((await api('GET', `/api/collections/notifications/records/${id}`, adminAuth())).status, 200)

	const purge = await runJob('notifications', FUTURE_CUTOFF)
	assert.equal(purge.status, 200)
	assert.ok(purge.json.deleted >= 1, 'expired notification deleted')
	assert.equal((await api('GET', `/api/collections/notifications/records/${id}`, adminAuth())).status, 404)

	const again = await runJob('notifications', FUTURE_CUTOFF)
	assert.equal(again.json.deleted, 0, 'second run is a no-op')
})

test('notifications: purge spans multiple keyset-pagination batches', async () => {
	// RETENTION_PAGE_SIZE=2, so 5 records force at least 3 pages — a regression guard
	// for the batched delete loop (offset drift / early termination).
	const u = await makeUser('retbatch')
	const ids = []
	for (let i = 0; i < 5; i++) {
		const r = await api('POST', '/api/collections/notifications/records', adminAuth(), {
			recipient: u.id,
			type: 'new_message',
			relatedId: `batch${i}`,
			body: `Batch ${i}`,
			read: false,
		})
		assert.equal(r.status, 200)
		ids.push(r.json.id)
	}
	const purge = await runJob('notifications', FUTURE_CUTOFF)
	assert.ok(purge.json.deleted >= 5, 'all pages processed')
	for (const id of ids) {
		assert.equal((await api('GET', `/api/collections/notifications/records/${id}`, adminAuth())).status, 404)
	}
})

test('feedback: purged after the window, retained inside it, idempotent', async () => {
	// feedback createRule is open (anonymous submissions).
	const created = await api('POST', '/api/collections/feedback/records', null, {
		feedbackMessage: 'Retention test feedback',
		route: '/test',
	})
	assert.equal(created.status, 200)
	const id = created.json.id

	const keep = await runJob('feedback', PAST_CUTOFF)
	assert.equal(keep.json.deleted, 0)
	assert.equal((await api('GET', `/api/collections/feedback/records/${id}`, adminAuth())).status, 200)

	const purge = await runJob('feedback', FUTURE_CUTOFF)
	assert.ok(purge.json.deleted >= 1)
	assert.equal((await api('GET', `/api/collections/feedback/records/${id}`, adminAuth())).status, 404)

	const again = await runJob('feedback', FUTURE_CUTOFF)
	assert.equal(again.json.deleted, 0, 'second run is a no-op')
})

test('conversations: purge removes messages + related notifications, ignores lendingStatus', async () => {
	const u1 = await makeUser('retconvreq')
	const u2 = await makeUser('retconvown')
	const itemId = await createItem(u2.id)

	const msg = await api('POST', '/api/collections/messages/records', adminAuth(), {
		messageContent: 'Alte Nachricht',
		from: u1.id,
		to: u2.id,
	})
	assert.equal(msg.status, 200)

	const conv = await api('POST', '/api/collections/conversations/records', adminAuth(), {
		requester: u1.id,
		itemOwner: u2.id,
		requestedItem: itemId,
		messages: [msg.json.id],
		lendingStatus: 'active', // an OPEN loan — job 2 deletes regardless (decided in #461)
	})
	assert.equal(conv.status, 200)

	const notif = await api('POST', '/api/collections/notifications/records', adminAuth(), {
		recipient: u2.id,
		sender: u1.id,
		type: 'new_message',
		relatedId: conv.json.id,
		body: 'Neue Nachricht',
		read: false,
	})
	assert.equal(notif.status, 200)

	const keep = await runJob('conversations', PAST_CUTOFF)
	assert.equal(keep.json.deleted, 0, 'fresh conversation retained')
	assert.equal((await api('GET', `/api/collections/conversations/records/${conv.json.id}`, adminAuth())).status, 200)

	const purge = await runJob('conversations', FUTURE_CUTOFF)
	assert.ok(purge.json.deleted >= 1, 'expired conversation deleted despite open loan')
	assert.equal((await api('GET', `/api/collections/conversations/records/${conv.json.id}`, adminAuth())).status, 404)
	assert.equal((await api('GET', `/api/collections/messages/records/${msg.json.id}`, adminAuth())).status, 404, 'its messages are gone')
	assert.equal((await api('GET', `/api/collections/notifications/records/${notif.json.id}`, adminAuth())).status, 404, 'its notifications are gone')

	const again = await runJob('conversations', FUTURE_CUTOFF)
	assert.equal(again.json.deleted, 0, 'second run is a no-op')
})

test('inactive accounts: anonymized after the window; open loan skips; active user survives', async () => {
	const uOld = await makeUser('retinactold')
	const uFresh = await makeUser('retinactfresh')
	const uLoan = await makeUser('retinactloan')

	// makeUser logs in, which stamps lastLoginAt=now — backdate the two "inactive" users.
	for (const id of [uOld.id, uLoan.id]) {
		const r = await api('PATCH', `/api/collections/users/records/${id}`, adminAuth(), {
			lastLoginAt: BACKDATED_LOGIN,
		})
		assert.equal(r.status, 200)
	}

	// uLoan has an open loan with uFresh.
	const itemId = await createItem(uFresh.id)
	const conv = await api('POST', '/api/collections/conversations/records', adminAuth(), {
		requester: uLoan.id,
		itemOwner: uFresh.id,
		requestedItem: itemId,
		lendingStatus: 'accepted',
	})
	assert.equal(conv.status, 200)

	const run = await runJob('inactive-accounts', INACTIVE_CUTOFF)
	assert.equal(run.status, 200)
	assert.equal(run.json.anonymized, 1, 'exactly the inactive user without loans')
	assert.equal(run.json.skipped, 1, 'the open-loan user is skipped')

	const oldRow = await api('GET', `/api/collections/users/records/${uOld.id}`, adminAuth())
	assert.equal(oldRow.json.deleted, true, 'inactive user anonymized')
	assert.equal(oldRow.json.username, `deleted-${uOld.id}`, 'username scrubbed like self-deletion')

	const freshRow = await api('GET', `/api/collections/users/records/${uFresh.id}`, adminAuth())
	assert.equal(!!freshRow.json.deleted, false, 'recently active user untouched')

	const loanRow = await api('GET', `/api/collections/users/records/${uLoan.id}`, adminAuth())
	assert.equal(!!loanRow.json.deleted, false, 'open-loan user NOT anonymized')

	// Close the loan — the next run may now anonymize the still-inactive user.
	const done = await api('PATCH', `/api/collections/conversations/records/${conv.json.id}`, adminAuth(), {
		lendingStatus: 'completed',
	})
	assert.equal(done.status, 200)

	const rerun = await runJob('inactive-accounts', INACTIVE_CUTOFF)
	assert.equal(rerun.json.anonymized, 1, 'formerly blocked user anonymized once the loan closed')
	assert.equal(rerun.json.skipped, 0)
	const loanRowAfter = await api('GET', `/api/collections/users/records/${uLoan.id}`, adminAuth())
	assert.equal(loanRowAfter.json.deleted, true)

	const noop = await runJob('inactive-accounts', INACTIVE_CUTOFF)
	assert.equal(noop.json.anonymized, 0, 'third run is a no-op')
	assert.equal(noop.json.skipped, 0)
})

test('lastLoginAt / retentionNotifiedAt are hidden from other users but visible to superuser', async () => {
	const alice = await makeUser('rethidea')
	const bob = await makeUser('rethideb')

	// users viewRule is `@request.auth.id != ""`, so Alice CAN fetch Bob's record —
	// the hidden flag is what keeps the retention fields out of the response.
	const asAlice = await api('GET', `/api/collections/users/records/${bob.id}`, alice.t)
	assert.equal(asAlice.status, 200)
	assert.ok(!('lastLoginAt' in asAlice.json), 'lastLoginAt not leaked to other authenticated users')
	assert.ok(!('retentionNotifiedAt' in asAlice.json), 'retentionNotifiedAt not leaked to other authenticated users')

	// The job reads it via the superuser $app context, so superusers must still see it.
	const asAdmin = await api('GET', `/api/collections/users/records/${bob.id}`, adminAuth())
	assert.ok(asAdmin.json.lastLoginAt, 'superuser can still read lastLoginAt')
})

test('skip notice is stamped once and not re-sent within the cooldown window', async () => {
	const owner = await makeUser('retcdo')
	const borrower = await makeUser('retcdb')
	assert.equal(
		(await api('PATCH', `/api/collections/users/records/${borrower.id}`, adminAuth(), { lastLoginAt: BACKDATED_LOGIN })).status,
		200
	)
	const itemId = await createItem(owner.id)
	const conv = await api('POST', '/api/collections/conversations/records', adminAuth(), {
		requester: borrower.id,
		itemOwner: owner.id,
		requestedItem: itemId,
		lendingStatus: 'accepted', // keeps the borrower blocked (skipped) across runs
	})
	assert.equal(conv.status, 200)

	await runJob('inactive-accounts', INACTIVE_CUTOFF)
	const after1 = await api('GET', `/api/collections/users/records/${borrower.id}`, adminAuth())
	assert.equal(after1.json.deleted, false, 'blocked borrower is skipped, not anonymized')
	assert.ok(after1.json.retentionNotifiedAt, 'skip stamped retentionNotifiedAt')
	const stamp1 = after1.json.retentionNotifiedAt

	await runJob('inactive-accounts', INACTIVE_CUTOFF)
	const after2 = await api('GET', `/api/collections/users/records/${borrower.id}`, adminAuth())
	assert.equal(after2.json.retentionNotifiedAt, stamp1, 'not re-stamped within the cooldown window')
})

// Runs LAST: the future cutoff also sweeps up leftover users from earlier tests.
test('inactive accounts: never-logged-in users fall back to created', async () => {
	const u = await makeUser('retnologin')
	// Simulate an account that never stamped a login.
	const r = await api('PATCH', `/api/collections/users/records/${u.id}`, adminAuth(), {
		lastLoginAt: '',
	})
	assert.equal(r.status, 200)

	const run = await runJob('inactive-accounts', FUTURE_CUTOFF)
	assert.equal(run.status, 200)

	const row = await api('GET', `/api/collections/users/records/${u.id}`, adminAuth())
	assert.equal(row.json.deleted, true, 'never-logged-in user anonymized via created fallback')
})
