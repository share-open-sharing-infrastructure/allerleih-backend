// Issue #438 — the email-contact fields (contactViaEmail / contactEmail) carry
// off-platform PII. This pins down the two privacy-critical guarantees of the change
// (which production code, not just a comment, must keep upholding):
//   1. GDPR export (Art. 15/20) includes both fields.
//   2. Account deletion (Art. 17) clears both fields on the anonymized row.
//   3. The fields NEVER appear in any *_public / items_searchable view.
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { startPB, stopPB, makeUser, api, adminAuth } from './harness.mjs'

let pb

before(async () => {
	pb = await startPB()
})

after(() => stopPB(pb))

const CONTACT = { contactViaEmail: true, contactEmail: 'verleih@example.test' }

test('GDPR export includes contactViaEmail + contactEmail (Art. 15/20)', async () => {
	const u = await makeUser('exportcontact')
	const set = await api('PATCH', `/api/collections/users/records/${u.id}`, adminAuth(), CONTACT)
	assert.equal(set.status, 200)

	const exp = await api('GET', '/api/account/export', u.t)
	assert.equal(exp.status, 200)
	assert.equal(exp.json.profile.contactViaEmail, true, 'export carries contactViaEmail')
	assert.equal(exp.json.profile.contactEmail, 'verleih@example.test', 'export carries contactEmail')
})

test('account deletion clears contactViaEmail + contactEmail on the anonymized row (Art. 17)', async () => {
	const u = await makeUser('delcontact')
	assert.equal(
		(await api('PATCH', `/api/collections/users/records/${u.id}`, adminAuth(), CONTACT)).status,
		200
	)

	// makeUser's password is test1234; the DELETE hook re-authenticates before erasing.
	const del = await api('DELETE', '/api/account', u.t, { password: 'test1234' })
	assert.equal(del.status, 200, 'self-deletion succeeds')

	const row = await api('GET', `/api/collections/users/records/${u.id}`, adminAuth())
	assert.equal(row.json.deleted, true, 'row anonymized')
	assert.equal(row.json.contactViaEmail, false, 'contactViaEmail reset to false')
	assert.equal(row.json.contactEmail, '', 'contactEmail cleared')
})

test('contactViaEmail / contactEmail never appear in the public or searchable views', async () => {
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
	// so admin reads are the strictest check that the column simply isn't there.
	const checks = [
		['users_public', `/api/collections/users_public/records/${u.id}`],
		['items_public', `/api/collections/items_public/records/${it.json.id}`],
		['items_searchable', `/api/collections/items_searchable/records/${it.json.id}`],
	]
	for (const [view, path] of checks) {
		const res = await api('GET', path, adminAuth())
		assert.equal(res.status, 200, `${view} row readable`)
		assert.ok(!('contactEmail' in res.json), `${view} must not expose contactEmail`)
		assert.ok(!('contactViaEmail' in res.json), `${view} must not expose contactViaEmail`)
	}
})
