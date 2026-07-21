// CSV-import write path (#487 Phase 3): POST /api/import/{apply,preview,refresh}
// (integration_import.pb.js + integrations/import.js). Institution-scoped, normal user auth, owner
// always stamped server-side. Each test boots its own throwaway PocketBase; institution users are
// created via the superuser and driven with their OWN user token (the endpoints require a normal
// authenticated institutional account, never a superuser).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { setTimeout as sleep } from 'node:timers/promises'
import { startPB, stopPB, adminAuth, api } from './harness.mjs'

const DESCRIPTION_PREFIX = '[Nicht mehr im Bestand] '

// --- helpers ------------------------------------------------------------------------------

let seq = 0
/** Creates a user (superuser) and logs in → { id, username, token }. */
async function mkUser(isInstitution, name) {
    const username = name || `imp${++seq}`
    const email = `${username}@test.local`
    const password = 'test1234'
    const created = await api('POST', '/api/collections/users/records', adminAuth(), {
        email, password, passwordConfirm: password, username, isInstitution: !!isInstitution,
    })
    assert.equal(created.status, 200, `create user ${username}: ${JSON.stringify(created.json)}`)
    const auth = await api('POST', '/api/collections/users/auth-with-password', null, { identity: email, password })
    assert.equal(auth.status, 200, `auth user ${username}: ${JSON.stringify(auth.json)}`)
    return { id: created.json.id, username, token: auth.json.token }
}

async function seedItem(fields) {
    const created = await api('POST', '/api/collections/items/records', adminAuth(), fields)
    assert.equal(created.status, 200, `seed item: ${JSON.stringify(created.json)}`)
    return created.json.id
}

async function getItem(id) {
    return (await api('GET', `/api/collections/items/records/${id}`, adminAuth())).json
}
async function itemsByExternalId(externalId) {
    const r = await api('GET', `/api/collections/items/records?perPage=200&filter=${encodeURIComponent(`externalId="${externalId}"`)}`, adminAuth())
    return r.json.items
}
async function countItems(ownerId) {
    const r = await api('GET', `/api/collections/items/records?perPage=1&filter=${encodeURIComponent(`owner="${ownerId}"`)}`, adminAuth())
    return r.json.totalItems
}

/** A mapped import row (no owner — the endpoint stamps it). */
function rowOf(over) {
    return Object.assign(
        { externalId: 'x', name: 'Ding', description: 'd', status: 'available', categories: ['Sonstiges'], externalUrl: '', externalImgUrl: '', place: 'Stadt', trusteesOnly: false },
        over
    )
}

function apply(token, rows) {
    return api('POST', '/api/import/apply', token, { rows })
}

// --- apply: 1-11 --------------------------------------------------------------------------

test('1. apply requires authentication (401)', async () => {
    const pb = await startPB()
    try {
        const res = await api('POST', '/api/import/apply', null, { rows: [] })
        assert.ok(res.status === 401 || res.status === 403, `unauthenticated must be rejected (got ${res.status})`)
    } finally { stopPB(pb) }
})

test('2. apply is institution-only (403 for a normal user)', async () => {
    const pb = await startPB()
    try {
        const user = await mkUser(false)
        const res = await apply(user.token, [rowOf({ externalId: 'a' })])
        assert.equal(res.status, 403, `non-institution must get 403 (got ${res.status})`)
    } finally { stopPB(pb) }
})

test('3. apply create: new rows become items owned by the caller', async () => {
    const pb = await startPB()
    try {
        const inst = await mkUser(true)
        const res = await apply(inst.token, [
            rowOf({ externalId: 'c-1', name: 'Eins', status: 'available', categories: ['Küche'] }),
            rowOf({ externalId: 'c-2', name: 'Zwei', status: 'unavailable' }),
        ])
        assert.equal(res.status, 200, JSON.stringify(res.json))
        assert.equal(res.json.created, 2)
        assert.equal(res.json.fetched, 2)
        assert.equal(res.json.institution, inst.username)

        const c1 = (await itemsByExternalId('c-1'))[0]
        assert.ok(c1, 'c-1 created')
        assert.equal(c1.owner, inst.id, 'owner stamped to caller')
        assert.equal(c1.name, 'Eins')
        assert.deepEqual(c1.categories, ['Küche'])
        assert.equal(c1.trusteesOnly, false)
        assert.equal(await countItems(inst.id), 2)
    } finally { stopPB(pb) }
})

test('4. apply update: changed row updates the item; owner/trusteesOnly untouched (projection)', async () => {
    const pb = await startPB()
    try {
        const inst = await mkUser(true)
        const itemId = await seedItem({
            name: 'Alt', owner: inst.id, externalId: 'u-1', status: 'unavailable',
            categories: ['Sonstiges'], description: 'alt', place: 'Stadt', trusteesOnly: true,
        })
        const res = await apply(inst.token, [rowOf({ externalId: 'u-1', name: 'Neu', status: 'available' })])
        assert.equal(res.status, 200, JSON.stringify(res.json))
        assert.equal(res.json.updated, 1)

        const item = await getItem(itemId)
        assert.equal(item.name, 'Neu')
        assert.equal(item.status, 'available')
        assert.equal(item.trusteesOnly, true, 'trusteesOnly preserved')
        assert.equal(item.owner, inst.id, 'owner preserved')
    } finally { stopPB(pb) }
})

test('5. apply archive + idempotency: an item absent from the upload is archived once', async () => {
    const pb = await startPB()
    try {
        const inst = await mkUser(true)
        await seedItem({ name: 'A', owner: inst.id, externalId: 'a', status: 'available', categories: ['Sonstiges'], description: 'A', place: 'S' })
        const goneId = await seedItem({ name: 'Weg', owner: inst.id, externalId: 'gone', status: 'available', categories: ['Sonstiges'], description: 'Weg', place: 'S' })

        const rows = [rowOf({ externalId: 'a', name: 'A', description: 'A', place: 'S' })]
        const res1 = await apply(inst.token, rows)
        assert.equal(res1.status, 200)
        assert.equal(res1.json.archived, 1, 'the missing item is archived')
        const g1 = await getItem(goneId)
        assert.equal(g1.status, 'unavailable')
        assert.equal(g1.description, DESCRIPTION_PREFIX + 'Weg', 'prefix prepended once')

        const res2 = await apply(inst.token, rows)
        assert.equal(res2.status, 200)
        assert.equal(res2.json.archived, 0, 'second run archives nothing (idempotent)')
        const g2 = await getItem(goneId)
        assert.equal(g2.description, DESCRIPTION_PREFIX + 'Weg', 'no double prefix')
    } finally { stopPB(pb) }
})

test('6. owner-isolation: a foreign externalId creates a NEW owned item; the foreign item is untouched', async () => {
    const pb = await startPB()
    try {
        const a = await mkUser(true, 'insta')
        const b = await mkUser(true, 'instb')
        const bItemId = await seedItem({
            name: 'B Item', owner: b.id, externalId: 'shared-x', status: 'available',
            categories: ['Sonstiges'], description: 'b', place: 'B', trusteesOnly: true,
        })

        const res = await apply(a.token, [rowOf({ externalId: 'shared-x', name: 'A Version', status: 'unavailable' })])
        assert.equal(res.status, 200)
        assert.equal(res.json.created, 1, 'A creates its own item (foreign externalId is unknown to A)')
        assert.equal(res.json.updated, 0)

        const bItem = await getItem(bItemId)
        assert.equal(bItem.name, 'B Item', "B's item name unchanged")
        assert.equal(bItem.status, 'available', "B's item status unchanged")
        assert.equal(bItem.owner, b.id)

        const rows = await itemsByExternalId('shared-x')
        assert.equal(rows.length, 2, 'both owners now have an item with this externalId')
        const aItem = rows.find((r) => r.owner === a.id)
        assert.ok(aItem && aItem.name === 'A Version', "A's new item is owned by A")
    } finally { stopPB(pb) }
})

test('7. owner in the payload is ignored — the item is owned by the caller', async () => {
    const pb = await startPB()
    try {
        const a = await mkUser(true, 'ownera')
        const b = await mkUser(true)
        const res = await apply(a.token, [rowOf({ externalId: 'o-1', name: 'X', owner: b.id })])
        assert.equal(res.status, 200)
        assert.equal(res.json.created, 1)
        const item = (await itemsByExternalId('o-1'))[0]
        assert.equal(item.owner, a.id, 'owner is the caller, not the payload value')
    } finally { stopPB(pb) }
})

test('8. transaction: a failing write rolls back the whole batch (no partial writes)', async () => {
    const pb = await startPB()
    try {
        const inst = await mkUser(true)
        // Second row carries a category value outside the fixed select set → $app.save rejects it →
        // create throws → the whole transaction rolls back (the first, valid create is reverted too).
        const res = await apply(inst.token, [
            rowOf({ externalId: 'ok-1', name: 'Gut' }),
            rowOf({ externalId: 'bad-1', name: 'Kaputt', categories: ['NichtExistierendeKategorie'] }),
        ])
        assert.equal(res.status, 200, JSON.stringify(res.json))
        assert.ok(res.json.errors.length >= 1, 'the write failure is recorded in the summary')
        assert.equal(res.json.created, 0, 'nothing created (rolled back)')
        assert.equal((await itemsByExternalId('ok-1')).length, 0, 'valid row NOT persisted (rollback)')
        assert.equal((await itemsByExternalId('bad-1')).length, 0)
        assert.equal(await countItems(inst.id), 0)
    } finally { stopPB(pb) }
})

test('9. dedupe keep-last: a duplicated externalId yields ONE item with the last row wins', async () => {
    const pb = await startPB()
    try {
        const inst = await mkUser(true)
        const res = await apply(inst.token, [
            rowOf({ externalId: 'dup', name: 'First', status: 'available' }),
            rowOf({ externalId: 'dup', name: 'Last', status: 'unavailable' }),
        ])
        assert.equal(res.status, 200, JSON.stringify(res.json))
        const rows = await itemsByExternalId('dup')
        assert.equal(rows.length, 1, 'exactly one item despite the duplicate (no unique index)')
        assert.equal(rows[0].name, 'Last', 'keep-last: the later row wins')
        assert.equal(rows[0].status, 'unavailable')
    } finally { stopPB(pb) }
})

test('10. a row without externalId is a hard 400', async () => {
    const pb = await startPB()
    try {
        const inst = await mkUser(true)
        const res = await api('POST', '/api/import/apply', inst.token, { rows: [{ name: 'no id', status: 'available' }] })
        assert.equal(res.status, 400, `missing externalId must be 400 (got ${res.status})`)

        const notArray = await api('POST', '/api/import/apply', inst.token, { rows: 'nope' })
        assert.equal(notArray.status, 400, 'non-array rows must be 400')
    } finally { stopPB(pb) }
})

test('11. a large ~5000-row payload is accepted in one request (no 413)', async () => {
    const pb = await startPB()
    try {
        const inst = await mkUser(true)
        const rows = []
        const bigDesc = 'x'.repeat(4000)
        for (let i = 0; i < 5000; i++) {
            rows.push(rowOf({ externalId: `big-${i}`, name: `Item ${i}`, description: bigDesc }))
        }
        const res = await apply(inst.token, rows)
        assert.equal(res.status, 200, `5000-row apply must be 200, not 413 (got ${res.status})`)
        assert.equal(res.json.created, 5000, 'all 5000 rows created in one request')
    } finally { stopPB(pb) }
})

// --- preview (dryRun, Q2=b) ---------------------------------------------------------------

test('12. preview computes the diff but writes nothing', async () => {
    const pb = await startPB()
    try {
        const inst = await mkUser(true)
        const existingId = await seedItem({
            name: 'Alt', owner: inst.id, externalId: 'p-x', status: 'unavailable',
            categories: ['Sonstiges'], description: 'alt', place: 'Stadt',
        })
        const res = await api('POST', '/api/import/preview', inst.token, {
            rows: [rowOf({ externalId: 'p-x', name: 'Neu', status: 'available' }), rowOf({ externalId: 'p-y', name: 'Ganz neu' })],
        })
        assert.equal(res.status, 200, JSON.stringify(res.json))
        assert.equal(res.json.summary.create, 1, 'p-y is a create')
        assert.equal(res.json.summary.update, 1, 'p-x is an update')
        assert.equal(res.json.summary.archive, 0)
        const actionX = res.json.rowActions.find((r) => r.externalId === 'p-x')
        const actionY = res.json.rowActions.find((r) => r.externalId === 'p-y')
        assert.equal(actionX.action, 'update')
        assert.equal(actionY.action, 'create')

        // Nothing written.
        assert.equal((await getItem(existingId)).status, 'unavailable', 'preview did not update the item')
        assert.equal((await itemsByExternalId('p-y')).length, 0, 'preview did not create anything')
    } finally { stopPB(pb) }
})

// --- refresh (own items only) -------------------------------------------------------------

test('13. refresh refreshes the caller\'s own items only (not others)', async () => {
    // WINBIAP WebOPAC stub → StatusId 1 (available).
    const win = createServer((req, res) => {
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ Data: [{ CatalogData: { MediaItemsUnsorted: [{ StatusId: 1 }] } }] }))
    })
    await new Promise((r) => win.listen(0, '127.0.0.1', r))
    const winUrl = `http://127.0.0.1:${win.address().port}/webopac`
    const pb = await startPB({ INTEGRATION_ALLOW_INSECURE_URL: 'true' })
    try {
        const a = await mkUser(true, 'refa')
        const b = await mkUser(true, 'refb')
        // A has a winbiap sync_config + a barcode item (unknown → should become available).
        const cfg = await api('POST', '/api/collections/sync_config/records', adminAuth(), {
            institution: a.id, integration: 'winbiap', baseUrl: winUrl, enabled: true,
        })
        assert.equal(cfg.status, 200, JSON.stringify(cfg.json))
        const aItemId = await seedItem({ name: 'A Buch', owner: a.id, externalId: '118$5031208P', status: 'unknown', categories: ['Bücher'], description: 'a', place: 'A' })
        // B has an item but no config → must never be touched by A's refresh.
        const bItemId = await seedItem({ name: 'B Buch', owner: b.id, externalId: '999$X', status: 'unknown', categories: ['Bücher'], description: 'b', place: 'B' })

        const res = await api('POST', '/api/import/refresh', a.token, {})
        assert.equal(res.status, 200, JSON.stringify(res.json))

        assert.equal((await getItem(aItemId)).status, 'available', "A's own item refreshed")
        assert.equal((await getItem(bItemId)).status, 'unknown', "B's item untouched by A's refresh")

        // A non-institution user is rejected.
        const plain = await mkUser(false)
        const denied = await api('POST', '/api/import/refresh', plain.token, {})
        assert.equal(denied.status, 403)
    } finally {
        stopPB(pb)
        win.close(); win.closeAllConnections()
    }
})
