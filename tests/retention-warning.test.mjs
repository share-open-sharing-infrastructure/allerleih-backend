// Inactivity-deletion advance warning — the fifth retention job (see retention.pb.js).
// Same harness pattern as retention.test.mjs: cron schedules can't be fired on demand,
// so RETENTION_TEST_ROUTE=true exposes POST /api/_test/run-retention/inactive-warnings
// and the tests pass an explicit cutoff (autodate columns can't be backdated, but the
// hidden lastLoginAt/deletionWarnedAt date fields can — via superuser PATCH).
// DRY_MODE=true suppresses real SMTP; the deletionWarnedAt stamp is written anyway so
// the once-per-cycle gate stays observable.
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { startPB, stopPB, makeUser, api, adminAuth } from './harness.mjs'

let pb

before(async () => {
	// Small page size so the keyset-pagination loop runs multiple times (cf. retention.test.mjs).
	pb = await startPB({ RETENTION_TEST_ROUTE: 'true', DRY_MODE: 'true', RETENTION_PAGE_SIZE: '2' })
})

after(() => stopPB(pb))

const BACKDATED_LOGIN = '2020-01-01 00:00:00.000Z'
const WARN_CUTOFF = '2021-01-01 00:00:00.000Z' // between BACKDATED_LOGIN and now

const runJob = (cutoff) => api('POST', '/api/_test/run-retention/inactive-warnings', adminAuth(), { cutoff })

const backdateLogin = async (id, value = BACKDATED_LOGIN) => {
	const r = await api('PATCH', `/api/collections/users/records/${id}`, adminAuth(), { lastLoginAt: value })
	assert.equal(r.status, 200)
}

const userRow = async (id) => (await api('GET', `/api/collections/users/records/${id}`, adminAuth())).json

test('warns the inactive user exactly once; active user untouched', async () => {
	const uOld = await makeUser('warnold')
	const uFresh = await makeUser('warnfresh')
	await backdateLogin(uOld.id) // makeUser logs in, which stamps lastLoginAt=now

	const run = await runJob(WARN_CUTOFF)
	assert.equal(run.status, 200)
	assert.equal(run.json.warned, 1, 'exactly the backdated user')
	assert.equal(run.json.failed, 0)

	const oldRow = await userRow(uOld.id)
	assert.ok(oldRow.deletionWarnedAt, 'warning stamped (even under DRY_MODE)')
	assert.equal(!!oldRow.deleted, false, 'warning job never deletes anything')
	assert.ok(!(await userRow(uFresh.id)).deletionWarnedAt, 'recently active user not warned')

	const again = await runJob(WARN_CUTOFF)
	assert.equal(again.json.warned, 0, 'second run is a no-op — once per cycle')
	assert.equal((await userRow(uOld.id)).deletionWarnedAt, oldRow.deletionWarnedAt, 'stamp unchanged')
})

test('a login after the warning re-arms it for the next inactivity cycle', async () => {
	const u = await makeUser('warncycle')
	// Simulate a full previous cycle: warned in 2020, logged in AFTER the warning,
	// then went inactive again (both timestamps predate the cutoff).
	await backdateLogin(u.id, '2020-07-01 00:00:00.000Z')
	const stamped = await api('PATCH', `/api/collections/users/records/${u.id}`, adminAuth(), {
		deletionWarnedAt: '2020-06-01 00:00:00.000Z',
	})
	assert.equal(stamped.status, 200)

	const run = await runJob(WARN_CUTOFF)
	assert.equal(run.json.warned, 1, 'stale stamp (older than the login) does not block the new cycle')
	const row = await userRow(u.id)
	assert.ok(row.deletionWarnedAt > '2020-06-01', 'stamp renewed')
})

test('open-loan user is warned too (deletion would skip them, the warning does not)', async () => {
	const owner = await makeUser('warnowner')
	const borrower = await makeUser('warnborrow')
	await backdateLogin(borrower.id)

	const item = await api('POST', '/api/collections/items/records', adminAuth(), {
		name: 'WarnItem',
		description: 'd',
		place: 'p',
		owner: owner.id,
		trusteesOnly: false,
		status: 'available',
	})
	assert.equal(item.status, 200)
	const conv = await api('POST', '/api/collections/conversations/records', adminAuth(), {
		requester: borrower.id,
		itemOwner: owner.id,
		requestedItem: item.json.id,
		lendingStatus: 'accepted', // would block the DELETION job
	})
	assert.equal(conv.status, 200)

	const run = await runJob(WARN_CUTOFF)
	assert.equal(run.json.warned, 1, 'open loan does not suppress the warning')
	assert.ok((await userRow(borrower.id)).deletionWarnedAt)
})

test('already-deleted accounts are not warned', async () => {
	const u = await makeUser('warndeleted')
	await backdateLogin(u.id)
	const del = await api('PATCH', `/api/collections/users/records/${u.id}`, adminAuth(), { deleted: true })
	assert.equal(del.status, 200)

	const run = await runJob(WARN_CUTOFF)
	assert.equal(run.json.warned, 0)
	assert.ok(!(await userRow(u.id)).deletionWarnedAt)
})

test('never-logged-in users fall back to created', async () => {
	const u = await makeUser('warnnologin')
	await backdateLogin(u.id, '') // simulate an account that never stamped a login
	// `created` is an un-backdatable autodate, so only a future cutoff selects it —
	// scope the assertion to this user (a future cutoff sweeps up other test users too).
	const run = await runJob('2099-01-01 00:00:00.000Z')
	assert.equal(run.status, 200)
	assert.ok((await userRow(u.id)).deletionWarnedAt, 'warned via created fallback')
})

test('warning pass spans multiple keyset-pagination batches', async () => {
	// RETENTION_PAGE_SIZE=2, so 5 fresh candidates force at least 3 pages.
	const ids = []
	for (let i = 0; i < 5; i++) {
		const u = await makeUser(`warnbatch${i}`)
		await backdateLogin(u.id)
		ids.push(u.id)
	}
	const run = await runJob(WARN_CUTOFF)
	assert.equal(run.json.warned, 5, 'all pages processed')
	for (const id of ids) {
		assert.ok((await userRow(id)).deletionWarnedAt)
	}
})

test('deletionWarnedAt is hidden from other users but visible to superuser', async () => {
	const alice = await makeUser('warnhidea')
	const bob = await makeUser('warnhideb')
	await backdateLogin(bob.id)
	await runJob(WARN_CUTOFF)

	// users viewRule is `@request.auth.id != ""` — the hidden flag is the only thing
	// keeping the retention bookkeeping out of the response.
	const asAlice = await api('GET', `/api/collections/users/records/${bob.id}`, alice.t)
	assert.equal(asAlice.status, 200)
	assert.ok(!('deletionWarnedAt' in asAlice.json), 'deletionWarnedAt not leaked to other authenticated users')

	assert.ok((await userRow(bob.id)).deletionWarnedAt, 'superuser can still read it')
})
