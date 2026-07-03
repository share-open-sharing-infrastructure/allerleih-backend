// Integration-sync cron jobs (integration_sync.pb.js): registration from env
// config and the outbound call to the frontend's bearer-protected endpoint.
// A local HTTP stub plays the SvelteKit frontend; the job is fired on demand
// via the superuser /api/crons API instead of waiting for the schedule.
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { setTimeout as sleep } from 'node:timers/promises'
import { startPB, stopPB, adminAuth, api } from './harness.mjs'

const SECRET = 'test-sync-secret'

let pb
let stub
let stubPort
const stubRequests = []

before(async () => {
	// Stub frontend: record every request, answer like /api/sync with no institutions.
	stub = createServer((req, res) => {
		stubRequests.push({ method: req.method, url: req.url, authorization: req.headers['authorization'] })
		res.writeHead(200, { 'Content-Type': 'application/json' })
		res.end(JSON.stringify({ summaries: [] }))
	})
	await new Promise((resolve) => stub.listen(0, '127.0.0.1', resolve))
	stubPort = stub.address().port

	pb = await startPB({
		FRONTEND_URL: `http://127.0.0.1:${stubPort}`,
		SYNC_SECRET: SECRET,
		SYNC_CRON: '*/30 * * * *',
		// REFRESH_CRON intentionally unset — that job must not be registered.
	})
})

after(() => {
	stopPB(pb)
	// close() alone leaves PocketBase's idle keep-alive socket open, which keeps
	// the node:test process alive forever — destroy connections explicitly.
	stub?.close()
	stub?.closeAllConnections()
})

test('registers only the jobs whose cron env var is set', async () => {
	const res = await api('GET', '/api/crons', adminAuth())
	assert.equal(res.status, 200)

	const ids = res.json.map((j) => j.id)
	assert.ok(ids.includes('integration_sync'), `integration_sync missing from ${ids}`)
	assert.ok(!ids.includes('integration_refresh'), 'integration_refresh must not be registered without REFRESH_CRON')

	const syncJob = res.json.find((j) => j.id === 'integration_sync')
	assert.equal(syncJob.expression, '*/30 * * * *')
})

test('a triggered run POSTs /api/sync with the bearer secret', async () => {
	stubRequests.length = 0

	const run = await api('POST', '/api/crons/integration_sync', adminAuth())
	assert.equal(run.status, 204)

	// The job runs async on the server — poll briefly for the stub to be hit.
	for (let i = 0; i < 40 && stubRequests.length === 0; i++) {
		await sleep(250)
	}

	assert.equal(stubRequests.length, 1)
	assert.equal(stubRequests[0].method, 'POST')
	assert.equal(stubRequests[0].url, '/api/sync')
	assert.equal(stubRequests[0].authorization, `Bearer ${SECRET}`)
})

test('triggering a cron requires superuser auth', async () => {
	const res = await api('POST', '/api/crons/integration_sync', null)
	assert.ok(res.status === 401 || res.status === 403, `expected 401/403, got ${res.status}`)
})
