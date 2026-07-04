// The Batch API must be enabled (migration 1783101579_enable_batch_api.js):
// the frontend's integration syncs and the CSV import write items exclusively
// via batch requests, so a fresh instance where batch is disabled breaks them all.
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { startPB, stopPB, makeUser, api, adminAuth } from './harness.mjs'

let pb, owner

before(async () => {
	pb = await startPB()
	owner = await makeUser('batchowner')
})

after(() => stopPB(pb))

test('the migration enables batch.enabled in the instance settings', async () => {
	const settings = await api('GET', '/api/settings', adminAuth())
	assert.equal(settings.status, 200)
	assert.equal(settings.json.batch?.enabled, true, 'batch API must be enabled on a fresh instance')
})

test('a batch item create (the shape the integrations send) succeeds', async () => {
	const item = (name) => ({
		method: 'POST',
		url: '/api/collections/items/records',
		body: { name, description: 'd', place: 'p', owner: owner.id, trusteesOnly: false },
	})
	const res = await api('POST', '/api/batch', owner.t, {
		requests: [item('Batch-Artikel 1'), item('Batch-Artikel 2')],
	})
	assert.equal(res.status, 200, 'batch request rejected: ' + JSON.stringify(res.json))
	assert.equal(res.json.length, 2)
	assert.ok(res.json.every((r) => r.status === 200))
})
