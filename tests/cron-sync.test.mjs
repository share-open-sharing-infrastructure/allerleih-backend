// Integration-sync cron jobs (integration_sync.pb.js): registration from env
// config, the outbound calls to the frontend's bearer-protected endpoints, and
// the job body's logging branches (summaries, non-200, non-JSON, network failure).
// A local HTTP stub plays the SvelteKit frontend; jobs are fired on demand via
// the superuser /api/crons API instead of waiting for the schedule. The logging
// branches are asserted through PocketBase's own logs API (/api/logs), which
// end-to-end proves the job body returned cleanly inside the isolated cron
// context instead of throwing. Misconfig/fail-soft boots live in
// cron-sync-config.test.mjs.
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { setTimeout as sleep } from 'node:timers/promises'
import { startPB, stopPB, adminAuth, api } from './harness.mjs'

const SECRET = 'test-sync-secret'
const OK_RESPONSE = {
	status: 200,
	contentType: 'application/json',
	body: JSON.stringify({ summaries: [] }),
}

let pb
let stub
let stubPort
const stubRequests = []
// Mutable per test — lets individual tests exercise the non-200/non-JSON branches.
let stubResponse = OK_RESPONSE

before(async () => {
	// Stub frontend: record every request, answer with whatever stubResponse holds.
	stub = createServer((req, res) => {
		stubRequests.push({ method: req.method, url: req.url, authorization: req.headers['authorization'] })
		res.writeHead(stubResponse.status, { 'Content-Type': stubResponse.contentType })
		res.end(stubResponse.body)
	})
	await new Promise((resolve) => stub.listen(0, '127.0.0.1', resolve))
	stubPort = stub.address().port

	pb = await startPB({
		FRONTEND_URL: `http://127.0.0.1:${stubPort}`,
		SYNC_SECRET: SECRET,
		SYNC_CRON: '*/30 * * * *',
		REFRESH_CRON: '*/15 * * * *',
	})
})

after(() => {
	stopPB(pb)
	// close() alone leaves PocketBase's idle keep-alive socket open, which keeps
	// the node:test process alive forever — destroy connections explicitly.
	stub?.close()
	stub?.closeAllConnections()
})

/** Fire a cron job by id and wait until the stub has been hit `hits` times. */
async function triggerJob(jobId, hits = 1) {
	stubRequests.length = 0
	const run = await api('POST', `/api/crons/${jobId}`, adminAuth())
	assert.equal(run.status, 204)
	// The job runs async on the server — poll briefly for the stub to be hit.
	for (let i = 0; i < 40 && stubRequests.length < hits; i++) {
		await sleep(250)
	}
}

/**
 * Poll the superuser logs API for a message containing `substring`.
 * PocketBase writes logs in batches, so entries appear with a few seconds' lag.
 * Returns the matching log entries (fails the test on timeout).
 */
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

test('a triggered sync run POSTs /api/sync with the bearer secret', async () => {
	stubResponse = OK_RESPONSE
	await triggerJob('integration_sync')

	assert.equal(stubRequests.length, 1)
	assert.equal(stubRequests[0].method, 'POST')
	assert.equal(stubRequests[0].url, '/api/sync')
	assert.equal(stubRequests[0].authorization, `Bearer ${SECRET}`)
})

test('a triggered refresh run POSTs /api/refresh with the bearer secret', async () => {
	stubResponse = OK_RESPONSE
	await triggerJob('integration_refresh')

	assert.equal(stubRequests.length, 1)
	assert.equal(stubRequests[0].method, 'POST')
	assert.equal(stubRequests[0].url, '/api/refresh')
	assert.equal(stubRequests[0].authorization, `Bearer ${SECRET}`)
})

test('logs one line per institution summary, errors at error level', async () => {
	stubResponse = {
		status: 200,
		contentType: 'application/json',
		body: JSON.stringify({
			summaries: [
				// prettier-ignore
				{ institution: 'Leihlokal A', fetched: 2, created: 1, updated: 0, archived: 0, skipped: 1, errors: ['boom'], durationMs: 12 },
				// prettier-ignore
				{ institution: 'Leihlokal B', fetched: 5, created: 0, updated: 5, archived: 0, skipped: 0, errors: [], durationMs: 34 },
			],
		}),
	}
	await triggerJob('integration_sync')

	// 8 = error, 0 = info (PocketBase slog levels).
	const [withErrors] = await waitForLogs('Leihlokal A: fetched=2 created=1')
	assert.equal(withErrors.level, 8, 'summary with errors must log at error level')
	const [clean] = await waitForLogs('Leihlokal B: fetched=5 created=0')
	assert.equal(clean.level, 0, 'summary without errors must log at info level')
})

test('a 200 response with a non-JSON body is logged cleanly, job survives', async () => {
	stubResponse = { status: 200, contentType: 'text/html', body: '<html>SPA shell</html>' }
	await triggerJob('integration_sync')

	const [entry] = await waitForLogs('invalid JSON body')
	assert.equal(entry.level, 8)

	// The scheduler must survive the bad body: a follow-up run works normally.
	stubResponse = OK_RESPONSE
	await triggerJob('integration_sync')
	assert.equal(stubRequests.length, 1)
	assert.equal(stubRequests[0].url, '/api/sync')
})

test('a non-200 response is logged with status and truncated body', async () => {
	stubResponse = { status: 500, contentType: 'text/plain', body: 'kaputt' }
	await triggerJob('integration_sync')

	const [entry] = await waitForLogs('non-200 response')
	assert.equal(entry.level, 8)
})

test('triggering a cron requires superuser auth', async () => {
	const res = await api('POST', '/api/crons/integration_sync', null)
	assert.ok(res.status === 401 || res.status === 403, `expected 401/403, got ${res.status}`)
})

// LAST: kills the stub, so no stub-based test may run after this one.
test('an unreachable frontend is caught and logged, never thrown', async () => {
	stub.close()
	stub.closeAllConnections()
	stub = null

	const run = await api('POST', '/api/crons/integration_sync', adminAuth())
	assert.equal(run.status, 204)

	const [entry] = await waitForLogs('request failed')
	assert.equal(entry.level, 8)
})
