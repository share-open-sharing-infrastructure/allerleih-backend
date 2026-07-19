// Issue #520 — unit-test the purge predicate of migration 1783700000 directly.
// The integration harness applies migrations against an empty outbound_clicks
// table, so the delete loop never runs there and a broken predicate (leaving
// sensitive rows, or deleting legitimate partner rows) would pass unnoticed. We
// import the migration's OWN helpers (it guards its migrate() call so it is
// importable under Node) so the code under test is exactly what runs in prod.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import migration from '../pb_migrations/1783700000_outbound_clicks_lock_list_and_purge_messenger.js'

const { hostOf, isMessengerDestination } = migration

test('the migration exposes its helpers to Node', () => {
	assert.equal(typeof hostOf, 'function')
	assert.equal(typeof isMessengerDestination, 'function')
})

test('messenger destinations are matched (purged)', () => {
	const messenger = [
		'https://t.me/someuser',
		'https://telegram.me/someuser',
		'https://signal.me/#eu/abc123',
		'https://signal.group/#xyz',
		'https://www.signal.me/#eu/x', // www. stripped
		'https://T.ME/CAPS', // case-insensitive host
		'https://t.me:443/user', // explicit port ignored
		'https://user@t.me/x', // userinfo ignored
		'https://t.me', // no trailing slash
	]
	for (const url of messenger) {
		assert.equal(isMessengerDestination(url), true, `expected messenger: ${url} (host=${hostOf(url)})`)
	}
})

test('legitimate partner / social destinations are retained (NOT purged)', () => {
	const retained = [
		'https://verleih.example/form',
		'https://start.media.de/angebot', // must NOT match the "t.me" substring
		'https://norden.social/@AllerLeih',
		'https://allerleih.notion.site/abc',
		'https://signal.me.evil.example/phish', // look-alike host, not signal.me
		'https://t.me.attacker.example/x',
		'', // unparseable
		'not-a-url',
	]
	for (const url of retained) {
		assert.equal(isMessengerDestination(url), false, `expected retained: ${url} (host=${hostOf(url)})`)
	}
})
