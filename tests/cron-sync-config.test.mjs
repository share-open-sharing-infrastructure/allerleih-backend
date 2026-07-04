// Integration-sync cron registration guards (integration_sync.pb.js): boots
// PocketBase with broken/partial env configs and asserts the jobs fail soft —
// misconfigured or invalid jobs stay unregistered without taking the boot or
// the sibling job down. Each test boots its own instance (the runner is
// --test-concurrency=1, so the shared port/data dir is safe). Happy-path
// behavior lives in cron-sync.test.mjs.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { startPB, stopPB, adminAuth, api } from './harness.mjs'

async function registeredCronIds() {
	const res = await api('GET', '/api/crons', adminAuth())
	assert.equal(res.status, 200)
	return res.json.map((j) => j.id)
}

test('SYNC_CRON without FRONTEND_URL does not register the job', async () => {
	const pb = await startPB({
		SYNC_CRON: '*/30 * * * *',
		FRONTEND_URL: '', // deliberately incomplete — syncTargetConfigured must veto
		SYNC_SECRET: 'test-sync-secret',
		// REFRESH_CRON unset — that job must not be registered either.
	})
	try {
		const ids = await registeredCronIds()
		assert.ok(!ids.includes('integration_sync'), 'integration_sync must not be registered without FRONTEND_URL')
		assert.ok(!ids.includes('integration_refresh'), 'integration_refresh must not be registered without REFRESH_CRON')
	} finally {
		stopPB(pb)
	}
})

test('an invalid SYNC_CRON fails soft and does not block integration_refresh', async () => {
	const pb = await startPB({
		SYNC_CRON: 'not-a-cron',
		REFRESH_CRON: '*/15 * * * *',
		FRONTEND_URL: 'http://127.0.0.1:9', // never called — registration only
		SYNC_SECRET: 'test-sync-secret',
	})
	try {
		const ids = await registeredCronIds()
		assert.ok(!ids.includes('integration_sync'), 'the invalid SYNC_CRON must not register a job')
		assert.ok(
			ids.includes('integration_refresh'),
			`a bad SYNC_CRON must not prevent integration_refresh from registering (got ${ids})`
		)
	} finally {
		stopPB(pb)
	}
})
