// Integration cron jobs (integration_sync.pb.js): as of #487 Phase 2 BOTH integration_sync and
// integration_refresh run LOCALLY in the backend (integrations/sync.js + integrations/refresh.js) —
// neither POSTs the frontend anymore. This suite asserts registration + that neither job calls out
// to a configured FRONTEND_URL (a stub records any hit; it must stay at zero). The rich
// per-institution sync/refresh behaviour is covered by integration-sync.test.mjs +
// integration-refresh.test.mjs; misconfig/fail-soft boots live in cron-sync-config.test.mjs.
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { setTimeout as sleep } from 'node:timers/promises'
import { startPB, stopPB, adminAuth, api } from './harness.mjs'

let pb
let stub
const stubRequests = []

before(async () => {
	// Stub "frontend": records every request. FRONTEND_URL + SYNC_SECRET are set below but MUST be
	// ignored — both cron jobs run locally now, so this stub must never be hit.
	stub = createServer((req, res) => {
		stubRequests.push({ method: req.method, url: req.url })
		res.writeHead(200, { 'Content-Type': 'application/json' })
		res.end('{}')
	})
	await new Promise((resolve) => stub.listen(0, '127.0.0.1', resolve))

	pb = await startPB({
		FRONTEND_URL: `http://127.0.0.1:${stub.address().port}`,
		SYNC_SECRET: 'test-sync-secret',
		SYNC_CRON: '*/30 * * * *',
		REFRESH_CRON: '*/15 * * * *',
	})
})

after(() => {
	stopPB(pb)
	// close() alone leaves PocketBase's idle keep-alive socket open, which keeps the node:test
	// process alive forever — destroy connections explicitly.
	stub?.close()
	stub?.closeAllConnections()
})

/** Poll the superuser logs API for a message containing `substring` (logs are batched, so laggy). */
async function waitForLogs(substring, minCount = 1) {
	const filter = encodeURIComponent(`message~'${substring}'`)
	for (let i = 0; i < 80; i++) {
		const res = await api('GET', `/api/logs?perPage=100&sort=-created&filter=${filter}`, adminAuth())
		assert.equal(res.status, 200)
		if (res.json.items?.length >= minCount) return res.json.items
		await sleep(250)
	}
	assert.fail(`no log entry containing "${substring}" appeared within 20s`)
}

test('registers both jobs with their cron expressions', async () => {
	const res = await api('GET', '/api/crons', adminAuth())
	assert.equal(res.status, 200)

	const sync = res.json.find((j) => j.id === 'integration_sync')
	const refresh = res.json.find((j) => j.id === 'integration_refresh')
	assert.ok(sync, `integration_sync missing from ${res.json.map((j) => j.id)}`)
	assert.ok(refresh, `integration_refresh missing from ${res.json.map((j) => j.id)}`)
	assert.equal(sync.expression, '*/30 * * * *')
	assert.equal(refresh.expression, '*/15 * * * *')
})

test('a triggered sync run executes locally and does NOT POST the frontend', async () => {
	stubRequests.length = 0
	const run = await api('POST', '/api/crons/integration_sync', adminAuth())
	assert.equal(run.status, 204)

	// The local run logs a summary; no sync_config rows are seeded here, so it reports none.
	await waitForLogs('cron:sync] done')
	assert.equal(stubRequests.length, 0, 'integration_sync must not POST the frontend anymore')
})

test('a triggered refresh run executes locally and does NOT POST the frontend', async () => {
	stubRequests.length = 0
	const run = await api('POST', '/api/crons/integration_refresh', adminAuth())
	assert.equal(run.status, 204)

	await waitForLogs('cron:refresh] done')
	assert.equal(stubRequests.length, 0, 'integration_refresh must not POST the frontend anymore')
})

test('triggering a cron requires superuser auth', async () => {
	const res = await api('POST', '/api/crons/integration_sync', null)
	assert.ok(res.status === 401 || res.status === 403, `expected 401/403, got ${res.status}`)
})
