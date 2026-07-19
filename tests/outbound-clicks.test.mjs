// Issue #520 — outbound_clicks must NOT be publicly listable (it logged users'
// Signal/Telegram deep links). Migration 1783700000 locks listRule to superusers
// only while keeping createRule public so unauthenticated item/footer clicks can
// still be logged. These are collection rules, so they only run against a real
// PocketBase instance.
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { startPB, stopPB, api, adminAuth, makeUser } from './harness.mjs'

let pb

before(async () => {
	pb = await startPB()
})

after(() => stopPB(pb))

test('anyone can still log a click (createRule stays public)', async () => {
	const res = await api('POST', '/api/collections/outbound_clicks/records', null, {
		destination: 'https://verleih.example/form',
		source_page: 'item-detail',
	})
	assert.equal(res.status, 200, JSON.stringify(res.json))
})

test('unauthenticated listing is forbidden', async () => {
	const res = await api('GET', '/api/collections/outbound_clicks/records', null)
	assert.equal(res.status, 403, JSON.stringify(res.json))
})

test('a regular authenticated user cannot list', async () => {
	const user = await makeUser('clickpeeker')
	const res = await api('GET', '/api/collections/outbound_clicks/records', user.t)
	assert.equal(res.status, 403, JSON.stringify(res.json))
})

test('a superuser can list (analytics stay available to admins)', async () => {
	// Self-contained: seed our own row (createRule is public) so this does not
	// depend on another test having logged a click first.
	const seeded = await api('POST', '/api/collections/outbound_clicks/records', null, {
		destination: 'https://partner.example/catalogue',
		source_page: 'item-detail',
	})
	assert.equal(seeded.status, 200, JSON.stringify(seeded.json))

	const res = await api('GET', '/api/collections/outbound_clicks/records', adminAuth())
	assert.equal(res.status, 200, JSON.stringify(res.json))
	assert.ok(res.json.totalItems >= 1, 'the logged click should be visible to a superuser')
})
