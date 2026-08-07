// #607 review follow-up: two pure-logic pieces of jobs/digest.js, unit-tested WITHOUT spinning up
// a PocketBase instance.
//
// jobs/digest.js is a normal CommonJS module required fresh by digest.pb.js — NOT itself a
// `*.pb.js` hook file, so (per CLAUDE.md's isolated-context rule) it behaves like any ordinary
// require()'d module: its own top-level `require(`${__hooks}/...`)` calls execute exactly once,
// at first require(), like any CommonJS file. Its only two PocketBase-runtime dependencies at
// MODULE-LOAD time (not call time) are the `__hooks` magic path used in those template literals,
// and constants.js's `$os.getenv()` reads. Stubbing just those two lets this file require() the
// REAL jobs/digest.js and call its REAL renderItemList()/categorizeItemsForUser() — no PocketBase
// process needed for logic this pure.
//
// B1: renderItemList() had two bugs that made every item-with-image row unreadable once run
// through htmlToText() for the plaintext part — see htmlToText.js's own doc comment. This file's
// job is specifically to run the ACTUAL markup renderItemList() produces through htmlToText()
// (not a hand-typed substitute fragment — that was the gap the original review found: the
// existing html-to-text.test.mjs fixture didn't contain two adjacent <td>s at all).
//
// S2: categorizeItemsForUser() is the single most security-sensitive piece of this file — it
// decides who sees which item (trusteesOnly / group / public) — and used to only be reachable via
// the full HTTP run-digest integration test. It's pure w.r.t. its inputs, so it's tested directly
// here too.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'
import { htmlToText } from '../pb_hooks/utils/htmlToText.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const hooksDir = path.resolve(__dirname, '../pb_hooks')

globalThis.__hooks = hooksDir
globalThis.$os = { getenv: (name) => process.env[name] || '' }

const require = createRequire(import.meta.url)
const { renderItemList, categorizeItemsForUser } = require(path.join(hooksDir, 'jobs/digest.js'))

const ASSET = 'https://backend.example.test'
const SITE = 'https://fe.example.test'

/** Minimal fake PocketBase record — just enough for renderItemList()/categorizeItemsForUser(). */
function makeRecord(id, data) {
	return { id, get: (field) => data[field] }
}

// --- B1: renderItemList() -> htmlToText() must never glue two links/words together -----------

test('renderItemList()+htmlToText(): item WITH an image renders clean, unstuck plaintext', () => {
	const item = makeRecord('abc123', {
		name: 'Bohrmaschine',
		categories: ['Werkzeug'],
		owner: 'owner1',
		externalImgUrl: 'https://img.example.test/bohrmaschine.jpg',
	})
	const html = renderItemList(ASSET, SITE, [item], 5, { owner1: 'Alice' }, false)
	const text = htmlToText(html)

	assert.equal(
		text,
		'Bohrmaschine (https://fe.example.test/items/abc123)\n' +
			'von Alice\n' +
			'Werkzeug\n' +
			'Ansehen → (https://fe.example.test/items/abc123)'
	)
})

test('renderItemList()+htmlToText(): item WITHOUT an image renders the same shape (no image cell to glue onto)', () => {
	const item = makeRecord('def456', {
		name: 'Bohrmaschine',
		categories: ['Werkzeug'],
		owner: 'owner1',
	})
	const html = renderItemList(ASSET, SITE, [item], 5, { owner1: 'Alice' }, false)
	const text = htmlToText(html)

	assert.equal(
		text,
		'Bohrmaschine (https://fe.example.test/items/def456)\n' +
			'von Alice\n' +
			'Werkzeug\n' +
			'Ansehen → (https://fe.example.test/items/def456)'
	)
})

test('renderItemList()+htmlToText(): item WITHOUT owner AND WITHOUT category no longer glues the name onto "Ansehen"', () => {
	const item = makeRecord('ghi789', {
		name: 'Bohrmaschine',
		categories: [],
		owner: 'deletedOwner', // not present in the ownerNames map -> ownerName resolves to ''
	})
	const html = renderItemList(ASSET, SITE, [item], 5, {}, false)
	const text = htmlToText(html)

	assert.equal(
		text,
		'Bohrmaschine (https://fe.example.test/items/ghi789)\nAnsehen → (https://fe.example.test/items/ghi789)'
	)
})

test('renderItemList()+htmlToText(): no HTML tag leaks and no ")" is ever glued to the next character, across all three variants', () => {
	const withImage = makeRecord('i1', { name: 'A', categories: ['K'], owner: 'o', externalImgUrl: 'https://img.test/a.jpg' })
	const withoutImage = makeRecord('i2', { name: 'B', categories: ['K'], owner: 'o' })
	const withoutOwnerOrCategory = makeRecord('i3', { name: 'C', categories: [], owner: 'nobody' })

	for (const item of [withImage, withoutImage, withoutOwnerOrCategory]) {
		const text = htmlToText(renderItemList(ASSET, SITE, [item], 5, { o: 'Owner' }, false))
		assert.ok(!text.includes('<'), 'no HTML tag leaks into the plaintext')
		assert.ok(
			!/\)\S/.test(text.replace(/\n/g, ' ')),
			'a link\'s closing ")" must always be followed by whitespace, never glued to the next token'
		)
	}
})

// --- #622: renderItemList() image-URL resolution (items_searchable, escaping) -------------------
// No coverage of the uploaded-file branch existed before this: every fixture above uses
// externalImgUrl with allowUploadedImages=false. These exercise the `image` field directly.

test('renderItemList(): allowUploadedImages=true uses items_searchable with the whitelisted thumb, never items_public', () => {
	const item = makeRecord('pub1', {
		name: 'Bohrmaschine',
		categories: [],
		owner: 'owner1',
		image: ['photo_abc.png'],
	})
	const html = renderItemList(ASSET, SITE, [item], 5, { owner1: 'Alice' }, true)

	assert.ok(
		html.includes(`src="${ASSET}/api/files/items_searchable/pub1/photo_abc.png?thumb=0x300"`),
		'must build the items_searchable file URL with the whitelisted thumb size'
	)
	assert.ok(
		!html.includes('items_public'),
		'must never link an uploaded file through items_public (#622 — its image column is masked to json, 404)'
	)
})

test('renderItemList(): allowUploadedImages=false renders externalImgUrl instead, even when an uploaded image also exists', () => {
	const item = makeRecord('restricted1', {
		name: 'Bohrmaschine',
		categories: [],
		owner: 'owner1',
		image: ['photo_abc.png'],
		externalImgUrl: 'https://img.example.test/external.jpg',
	})
	const html = renderItemList(ASSET, SITE, [item], 5, { owner1: 'Alice' }, false)

	assert.ok(html.includes('src="https://img.example.test/external.jpg"'), 'must render externalImgUrl')
	assert.ok(
		!html.includes('/api/files/'),
		'trustees-only/group sections (allowUploadedImages=false) must never emit a file URL, even though the item has one'
	)
})

test('renderItemList(): allowUploadedImages=false with no externalImgUrl renders no <img> at all', () => {
	const item = makeRecord('restricted2', {
		name: 'Bohrmaschine',
		categories: [],
		owner: 'owner1',
		image: ['photo_abc.png'],
	})
	const html = renderItemList(ASSET, SITE, [item], 5, { owner1: 'Alice' }, false)

	assert.ok(
		!html.includes('<img'),
		'no uploaded-file URL and no externalImgUrl must mean no image at all — never falls back to the file URL'
	)
})

test('renderItemList(): a `"` in externalImgUrl is escaped and cannot break out of the src attribute', () => {
	const item = makeRecord('xss1', {
		name: 'Bohrmaschine',
		categories: [],
		owner: 'owner1',
		externalImgUrl: 'https://img.example.test/a.jpg"><script>alert(1)</script>',
	})
	const html = renderItemList(ASSET, SITE, [item], 5, { owner1: 'Alice' }, false)

	assert.ok(!html.includes('<script>'), 'the raw `"` must not be able to break out of the src="..." attribute')
	assert.ok(
		html.includes('src="https://img.example.test/a.jpg&quot;&gt;&lt;script&gt;alert(1)&lt;/script&gt;"'),
		'the externalImgUrl must be HTML-escaped inside the src attribute'
	)
})

// --- S2: categorizeItemsForUser() visibility rules ----------------------------------------------

test('categorizeItemsForUser: a trusteesOnly item is visible when the owner trusts the viewer', () => {
	const owner = makeRecord('owner1', { trusts: ['viewer1'] })
	const item = makeRecord('item1', { owner: 'owner1', trusteesOnly: true, groups: [] })
	const viewer = makeRecord('viewer1', {})

	const result = categorizeItemsForUser({
		user: viewer,
		newItems: [item],
		usersById: { owner1: owner },
		myGroups: new Set(),
		trustedSet: new Set(), // viewer does NOT trust the owner back
	})

	assert.deepEqual(result.trustedItems, [item], 'shown, but as "from someone who trusts you" not "public"')
	assert.deepEqual(result.groupItems, [])
	assert.deepEqual(result.publicItems, [])
})

test('categorizeItemsForUser: a trusteesOnly item is hidden entirely when the owner does NOT trust the viewer', () => {
	const owner = makeRecord('owner1', { trusts: ['someoneElse'] })
	const item = makeRecord('item1', { owner: 'owner1', trusteesOnly: true, groups: [] })
	const viewer = makeRecord('viewer1', {})

	const result = categorizeItemsForUser({
		user: viewer,
		newItems: [item],
		usersById: { owner1: owner },
		myGroups: new Set(),
		trustedSet: new Set(),
	})

	assert.deepEqual(result.trustedItems, [])
	assert.deepEqual(result.groupItems, [])
	assert.deepEqual(result.publicItems, [], 'not public either — trusteesOnly items never fall through to the public section')
})

test('categorizeItemsForUser: a group-only item is visible only to members of one of its groups', () => {
	const owner = makeRecord('owner1', {})
	const item = makeRecord('item1', { owner: 'owner1', trusteesOnly: false, groups: ['g1'] })
	const viewer = makeRecord('viewer1', {})

	const member = categorizeItemsForUser({
		user: viewer,
		newItems: [item],
		usersById: { owner1: owner },
		myGroups: new Set(['g1']),
		trustedSet: new Set(),
	})
	assert.deepEqual(member.groupItems, [item])
	assert.deepEqual(member.trustedItems, [])
	assert.deepEqual(member.publicItems, [])

	const nonMember = categorizeItemsForUser({
		user: viewer,
		newItems: [item],
		usersById: { owner1: owner },
		myGroups: new Set(['someOtherGroup']),
		trustedSet: new Set(),
	})
	assert.deepEqual(nonMember.groupItems, [], 'not a member of g1 -> hidden entirely')
	assert.deepEqual(nonMember.trustedItems, [])
	assert.deepEqual(nonMember.publicItems, [])
})

test('categorizeItemsForUser: the viewer\'s own items never appear in their own digest, regardless of visibility', () => {
	const owner = makeRecord('viewer1', {})
	const publicItem = makeRecord('item1', { owner: 'viewer1', trusteesOnly: false, groups: [] })
	const viewer = makeRecord('viewer1', {})

	const result = categorizeItemsForUser({
		user: viewer,
		newItems: [publicItem],
		usersById: { viewer1: owner },
		myGroups: new Set(),
		trustedSet: new Set(),
	})

	assert.deepEqual(result.trustedItems, [])
	assert.deepEqual(result.groupItems, [])
	assert.deepEqual(result.publicItems, [], "the viewer's own item must never appear, even though it is public")
})

test('categorizeItemsForUser: priority is trusted > group > public — a public item from a trusted owner lands in "trusted"', () => {
	const owner = makeRecord('owner1', {})
	const item = makeRecord('item1', { owner: 'owner1', trusteesOnly: false, groups: [] })
	const viewer = makeRecord('viewer1', {})

	const result = categorizeItemsForUser({
		user: viewer,
		newItems: [item],
		usersById: { owner1: owner },
		myGroups: new Set(),
		trustedSet: new Set(['owner1']), // viewer trusts the owner
	})

	assert.deepEqual(result.trustedItems, [item])
	assert.deepEqual(result.groupItems, [])
	assert.deepEqual(result.publicItems, [], 'must NOT also/instead land in "public" once it is already "trusted"')
})

test('categorizeItemsForUser: a genuinely public item (no trust, no group overlap) lands in "public"', () => {
	const owner = makeRecord('owner1', {})
	const item = makeRecord('item1', { owner: 'owner1', trusteesOnly: false, groups: [] })
	const viewer = makeRecord('viewer1', {})

	const result = categorizeItemsForUser({
		user: viewer,
		newItems: [item],
		usersById: { owner1: owner },
		myGroups: new Set(),
		trustedSet: new Set(),
	})

	assert.deepEqual(result.publicItems, [item])
	assert.deepEqual(result.trustedItems, [])
	assert.deepEqual(result.groupItems, [])
})
