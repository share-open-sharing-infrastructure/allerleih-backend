// Issue #438 — the off-platform contact fields (contactMethod / contactEmail / contactUrl
// / contactPublic) carry PII. This pins down the privacy-critical guarantees of the change
// (which production code, not just a comment, must keep upholding):
//   1. GDPR export (Art. 15/20) includes the contact fields.
//   2. Account deletion (Art. 17) clears them on the anonymized row.
//   3. The raw fields NEVER appear in any *_public / items_searchable view.
//   4. items_public exposes an owner's contact as ownerContact* columns ONLY when the
//      owner opted into public exposure (contactPublic = true) — members-only stays hidden.
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { startPB, stopPB, makeUser, api, adminAuth } from './harness.mjs'

let pb

before(async () => {
	pb = await startPB()
})

after(() => stopPB(pb))

const CONTACT = {
	contactMethod: 'email',
	contactEmail: 'verleih@example.test',
	contactUrl: '',
	contactPublic: false,
}

test('GDPR export includes the contact fields (Art. 15/20)', async () => {
	const u = await makeUser('exportcontact')
	const set = await api('PATCH', `/api/collections/users/records/${u.id}`, adminAuth(), CONTACT)
	assert.equal(set.status, 200)

	const exp = await api('GET', '/api/account/export', u.t)
	assert.equal(exp.status, 200)
	assert.equal(exp.json.profile.contactMethod, 'email', 'export carries contactMethod')
	assert.equal(exp.json.profile.contactEmail, 'verleih@example.test', 'export carries contactEmail')
	assert.equal(exp.json.profile.contactPublic, false, 'export carries contactPublic')
})

test('account deletion clears the contact fields on the anonymized row (Art. 17)', async () => {
	const u = await makeUser('delcontact')
	assert.equal(
		(await api('PATCH', `/api/collections/users/records/${u.id}`, adminAuth(), {
			...CONTACT,
			contactPublic: true,
		})).status,
		200
	)

	// makeUser's password is test1234; the DELETE hook re-authenticates before erasing.
	const del = await api('DELETE', '/api/account', u.t, { password: 'test1234' })
	assert.equal(del.status, 200, 'self-deletion succeeds')

	const row = await api('GET', `/api/collections/users/records/${u.id}`, adminAuth())
	assert.equal(row.json.deleted, true, 'row anonymized')
	assert.equal(row.json.contactMethod, '', 'contactMethod reset to off')
	assert.equal(row.json.contactEmail, '', 'contactEmail cleared')
	assert.equal(row.json.contactUrl, '', 'contactUrl cleared')
	assert.equal(row.json.contactPublic, false, 'contactPublic reset to false')
})

test('the raw contact fields never appear in the public or searchable views', async () => {
	const u = await makeUser('viewleak')
	assert.equal(
		(await api('PATCH', `/api/collections/users/records/${u.id}`, adminAuth(), CONTACT)).status,
		200
	)
	const it = await api('POST', '/api/collections/items/records', u.t, {
		name: 'LeakItem',
		description: 'd',
		place: 'p',
		owner: u.id,
		trusteesOnly: false,
		status: 'available',
	})
	assert.equal(it.status, 200)

	// A view returns only the columns in its viewQuery SELECT, regardless of who reads it,
	// so admin reads are the strictest check that the raw columns simply aren't there.
	const checks = [
		['users_public', `/api/collections/users_public/records/${u.id}`],
		['items_public', `/api/collections/items_public/records/${it.json.id}`],
		['items_searchable', `/api/collections/items_searchable/records/${it.json.id}`],
	]
	for (const [view, path] of checks) {
		const res = await api('GET', path, adminAuth())
		assert.equal(res.status, 200, `${view} row readable`)
		assert.ok(!('contactEmail' in res.json), `${view} must not expose raw contactEmail`)
		assert.ok(!('contactMethod' in res.json), `${view} must not expose raw contactMethod`)
		assert.ok(!('contactUrl' in res.json), `${view} must not expose raw contactUrl`)
	}
})

test('items_public exposes ownerContact* ONLY when the owner opted into public exposure (#438)', async () => {
	const u = await makeUser('publiccontact')
	// Members-only first: contactPublic = false → ownerContact* must be NULL.
	assert.equal(
		(await api('PATCH', `/api/collections/users/records/${u.id}`, adminAuth(), {
			contactMethod: 'email',
			contactEmail: 'verleih@example.test',
			contactPublic: false,
		})).status,
		200
	)
	const it = await api('POST', '/api/collections/items/records', u.t, {
		name: 'PublicContactItem',
		description: 'd',
		place: 'p',
		owner: u.id,
		trusteesOnly: false,
		status: 'available',
	})
	assert.equal(it.status, 200)

	let row = await api('GET', `/api/collections/items_public/records/${it.json.id}`, adminAuth())
	assert.equal(row.status, 200)
	assert.equal(row.json.ownerContactMethod, null, 'members-only: ownerContactMethod NULL')
	assert.equal(row.json.ownerContactEmail, null, 'members-only: ownerContactEmail NULL')

	// Opt into public → ownerContact* now carry the email.
	assert.equal(
		(await api('PATCH', `/api/collections/users/records/${u.id}`, adminAuth(), {
			contactPublic: true,
		})).status,
		200
	)
	row = await api('GET', `/api/collections/items_public/records/${it.json.id}`, adminAuth())
	assert.equal(row.json.ownerContactMethod, 'email', 'public: ownerContactMethod = email')
	assert.equal(row.json.ownerContactEmail, 'verleih@example.test', 'public: ownerContactEmail set')
	assert.equal(row.json.ownerContactUrl, null, 'public email contact: ownerContactUrl NULL')

	// A trustees-only (masked) item must NOT carry the contact even when public, since an
	// anonymous browser can't see the item at all.
	const masked = await api('POST', '/api/collections/items/records', u.t, {
		name: 'MaskedContactItem',
		description: 'd',
		place: 'p',
		owner: u.id,
		trusteesOnly: true,
		status: 'available',
	})
	assert.equal(masked.status, 200)
	const maskedRow = await api('GET', `/api/collections/items_public/records/${masked.json.id}`, adminAuth())
	assert.equal(maskedRow.json.ownerContactMethod, null, 'masked item: ownerContactMethod NULL')
	assert.equal(maskedRow.json.ownerContactEmail, null, 'masked item: ownerContactEmail NULL')

	// link method exposes ownerContactUrl, not ownerContactEmail.
	assert.equal(
		(await api('PATCH', `/api/collections/users/records/${u.id}`, adminAuth(), {
			contactMethod: 'link',
			contactUrl: 'https://verleih.example.test/form',
			contactPublic: true,
		})).status,
		200
	)
	row = await api('GET', `/api/collections/items_public/records/${it.json.id}`, adminAuth())
	assert.equal(row.json.ownerContactMethod, 'link', 'public: ownerContactMethod = link')
	assert.equal(row.json.ownerContactUrl, 'https://verleih.example.test/form', 'public: ownerContactUrl set')
	assert.equal(row.json.ownerContactEmail, null, 'public link contact: ownerContactEmail NULL')
})
