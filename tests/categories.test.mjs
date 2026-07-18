// Item categories are fixed and shared across all AllerLeih instances
// (share-mvp issue #472). CANONICAL_CATEGORIES below is the backend's single
// source of truth — it must equal ITEM_CATEGORIES in share-mvp
// src/lib/categories.ts. Changing the list requires a migration on the items
// collection's `categories` select values plus updating this array; see
// CLAUDE.md "Item categories" and the checklist in share-mvp docs/data-model.md.

import test, { before, after } from 'node:test'
import assert from 'node:assert/strict'
import { api, startPB, stopPB, makeUser, adminAuth } from './harness.mjs'

const CANONICAL_CATEGORIES = [
	'Freizeit und Sport',
	'Werkzeug und Garten',
	'Reisen und Outdoor',
	'Bücher',
	'Spiele',
	'Küche',
	'Ton und Licht',
	'Elektronik',
	'Für Kinder',
	'Sonstiges',
]

let proc

before(async () => {
	proc = await startPB()
})

after(() => stopPB(proc))

async function categoriesFieldValues(collection) {
	const res = await api('GET', `/api/collections/${collection}`, adminAuth())
	assert.equal(res.status, 200, `fetch ${collection} schema`)
	const field = res.json.fields.find((f) => f.name === 'categories')
	assert.ok(field, `${collection} has a categories field`)
	return field.values
}

for (const collection of ['items', 'items_public', 'items_searchable']) {
	test(`${collection}: categories select values match the canonical list`, async () => {
		const values = await categoriesFieldValues(collection)
		assert.equal(values.length, CANONICAL_CATEGORIES.length, 'no duplicates/missing values')
		assert.deepEqual(new Set(values), new Set(CANONICAL_CATEGORIES))
	})
}

test('items: canonical category accepted, unknown category rejected', async () => {
	const owner = await makeUser('catowner')
	const base = {
		name: 'Kategorie-Testitem',
		description: 'x',
		place: 'p',
		owner: owner.id,
		status: 'available',
	}

	const ok = await api('POST', '/api/collections/items/records', owner.t, {
		...base,
		categories: ['Werkzeug und Garten'],
	})
	assert.equal(ok.status, 200, 'canonical category should be accepted')

	const bad = await api('POST', '/api/collections/items/records', owner.t, {
		...base,
		categories: ['Nicht existent'],
	})
	assert.equal(bad.status, 400, 'unknown category should be rejected')
})
