// Backend full-catalogue pull (pb_hooks/integrations/sync.js, #487 Phase 2): the integration_sync
// cron now runs LOCALLY in the backend (was a POST to the frontend). Discovery reads `sync_config`
// (leihbackend only — WINBIAP has no bulk feed). Each test boots its own throwaway PocketBase (the
// run processes ALL configured institutions, so a fresh instance keeps cases isolated), seeds a
// sync_config row + a stub leihbackend `item_public` bulk feed on a loopback port
// (INTEGRATION_ALLOW_INSECURE_URL=true), fires POST /api/crons/integration_sync, and asserts the
// resulting item state + summary logs.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { setTimeout as sleep } from 'node:timers/promises'
import { startPB, stopPB, adminAuth, api } from './harness.mjs'

const SYNC_CRON = '*/15 * * * *'
// Byte-identical to DESCRIPTION_PREFIX in pb_hooks/integrations/diff.js (and its TS twin).
const DESCRIPTION_PREFIX = '[Nicht mehr im Bestand] '

// --- stub helpers -------------------------------------------------------------------------

function startStub(handler) {
    const server = createServer(handler)
    return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve(server)))
}
function stubUrl(server) {
    return `http://127.0.0.1:${server.address().port}`
}
function closeStub(server) {
    if (!server) return
    server.close()
    server.closeAllConnections()
}

/** A leihbackend item_public record. */
function lbRecord(over) {
    return Object.assign(
        {
            id: 'x', iid: 1, name: 'Ding', description: '', status: 'instock', deposit: 0,
            images: [], synonyms: '', category: ['sonstige'], brand: '', model: '',
            packaging: '', manual: '', parts: 1, copies: 1, added_on: '', is_protected: false,
        },
        over
    )
}

/**
 * leihbackend bulk-feed stub: paginates `records` over item_public/records.
 * opts.totalPagesOverride forces a bogus totalPages (truncated-feed guard test);
 * opts.status forces a non-2xx (fetch-failure test); opts.onHit counts requests.
 */
function bulkFeedHandler(records, opts) {
    opts = opts || {}
    return (req, res) => {
        if (req.url.indexOf('/api/collections/item_public/records') !== 0) {
            res.writeHead(404)
            res.end('nope')
            return
        }
        if (opts.onHit) opts.onHit()
        if (opts.status && opts.status >= 400) {
            res.writeHead(opts.status, { 'Content-Type': 'application/json' })
            res.end('{"code":' + opts.status + '}')
            return
        }
        const u = new URL(req.url, 'http://x')
        const page = parseInt(u.searchParams.get('page') || '1')
        const perPage = parseInt(u.searchParams.get('perPage') || '200')
        const totalPages = opts.totalPagesOverride != null ? opts.totalPagesOverride : Math.max(1, Math.ceil(records.length / perPage))
        const start = (page - 1) * perPage
        const items = records.slice(start, start + perPage)
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ page, perPage, totalItems: records.length, totalPages, items }))
    }
}

// --- seeding + polling helpers ------------------------------------------------------------

let instSeq = 0
/** Seeds an institution user + its sync_config row (integration derived from the URL). */
async function seedInstitution(opts) {
    const t = adminAuth()
    const username = opts.username || `inst${++instSeq}`
    const created = await api('POST', '/api/collections/users/records', t, {
        email: `${username}@test.local`, password: 'test1234', passwordConfirm: 'test1234',
        username, isInstitution: true, city: opts.city || '',
    })
    assert.equal(created.status, 200, `seed institution ${username}: ${JSON.stringify(created.json)}`)
    const id = created.json.id
    const integration = /\/webopac/i.test(opts.baseUrl || '') ? 'winbiap' : 'leihbackend'
    const cfg = await api('POST', '/api/collections/sync_config/records', t, {
        institution: id, integration, baseUrl: opts.baseUrl,
        itemUrlTemplate: opts.urlTemplate || '', enabled: opts.enabled === false ? false : true,
    })
    assert.equal(cfg.status, 200, `seed sync_config ${username}: ${JSON.stringify(cfg.json)}`)
    return { id, username }
}

async function seedItem(fields) {
    const created = await api('POST', '/api/collections/items/records', adminAuth(), fields)
    assert.equal(created.status, 200, `seed item: ${JSON.stringify(created.json)}`)
    return created.json.id
}

async function triggerSync() {
    const run = await api('POST', '/api/crons/integration_sync', adminAuth())
    assert.equal(run.status, 204, 'triggering integration_sync must return 204')
}

async function getItem(id) {
    return (await api('GET', `/api/collections/items/records/${id}`, adminAuth())).json
}
async function findByExternalId(ext) {
    const r = await api('GET', `/api/collections/items/records?filter=${encodeURIComponent(`externalId="${ext}"`)}`, adminAuth())
    return r.json.items && r.json.items[0]
}
async function countItems(ownerId) {
    const r = await api('GET', `/api/collections/items/records?perPage=1&filter=${encodeURIComponent(`owner="${ownerId}"`)}`, adminAuth())
    return r.json.totalItems
}

async function pollExternal(ext, tries = 60) {
    for (let i = 0; i < tries; i++) {
        const rec = await findByExternalId(ext)
        if (rec) return rec
        await sleep(200)
    }
    return null
}

function parseSummary(entry) {
    const m = /fetched=(\d+) created=(\d+) updated=(\d+) archived=(\d+) skipped=(\d+) errors=(\d+)/.exec(entry.message)
    assert.ok(m, `summary line not parseable: ${entry.message}`)
    return {
        message: entry.message, level: entry.level, data: entry.data,
        fetched: +m[1], created: +m[2], updated: +m[3], archived: +m[4], skipped: +m[5], errors: +m[6],
    }
}
async function waitLog(substring, tries = 100) {
    const filter = encodeURIComponent(`message~'${substring}'`)
    for (let i = 0; i < tries; i++) {
        const res = await api('GET', `/api/logs?perPage=50&sort=-created&filter=${filter}`, adminAuth())
        const items = res.json.items || []
        if (items.length) return items[0]
        await sleep(200)
    }
    return null
}
async function waitSummary(username) {
    const entry = await waitLog(`${username}:`)
    return entry ? parseSummary(entry) : null
}

// --- tests --------------------------------------------------------------------------------

test('1. create path: an empty DB gets one item per feed record (synced fields + externalId + owner + trusteesOnly=false)', async () => {
    const stub = await startStub(bulkFeedHandler([
        lbRecord({ id: 'c-1', name: 'Eins', status: 'instock', category: ['sonstige'] }),
        lbRecord({ id: 'c-2', name: 'Zwei', status: 'outofstock', category: ['kinder'] }),
    ]))
    const pb = await startPB({ SYNC_CRON, INTEGRATION_ALLOW_INSECURE_URL: 'true' })
    try {
        const inst = await seedInstitution({ baseUrl: stubUrl(stub), city: 'Stadt' })

        await triggerSync()
        const c1 = await pollExternal('c-1')
        assert.ok(c1, 'c-1 should be created')
        assert.equal(c1.name, 'Eins')
        assert.equal(c1.status, 'available', 'instock → available')
        assert.deepEqual(c1.categories, ['Sonstiges'])
        assert.equal(c1.owner, inst.id, 'owner stamped')
        assert.equal(c1.trusteesOnly, false, 'created public (trusteesOnly=false)')
        assert.equal(c1.place, 'Stadt')

        const c2 = await findByExternalId('c-2')
        assert.ok(c2, 'c-2 should be created')
        assert.equal(c2.status, 'unavailable', 'non-instock → unavailable')
        assert.deepEqual(c2.categories, ['Für Kinder'])
        assert.equal(await countItems(inst.id), 2, 'exactly two items created')
    } finally {
        stopPB(pb)
        closeStub(stub)
    }
})

test('2. update: a changed feed record updates the item; owner/trusteesOnly untouched', async () => {
    const stub = await startStub(bulkFeedHandler([
        lbRecord({ id: 'u-1', name: 'Neu', status: 'instock', category: ['sonstige'] }),
    ]))
    const pb = await startPB({ SYNC_CRON, INTEGRATION_ALLOW_INSECURE_URL: 'true' })
    try {
        const inst = await seedInstitution({ baseUrl: stubUrl(stub), city: 'Stadt' })
        const itemId = await seedItem({
            name: 'Alt', owner: inst.id, externalId: 'u-1', status: 'unavailable',
            categories: ['Sonstiges'], description: 'alt', place: 'Stadt', trusteesOnly: true,
        })

        await triggerSync()
        const updated = await (async () => {
            for (let i = 0; i < 60; i++) { const r = await getItem(itemId); if (r.status === 'available') return r; await sleep(200) }
            return null
        })()
        assert.ok(updated, 'item updated to available')
        assert.equal(updated.name, 'Neu', 're-mapped name')
        assert.equal(updated.trusteesOnly, true, 'trusteesOnly preserved (synced-fields projection)')
        assert.equal(updated.owner, inst.id, 'owner preserved')
    } finally {
        stopPB(pb)
        closeStub(stub)
    }
})

test('3. archive: an item missing from the feed is archived; a second run is idempotent', async () => {
    // Feed has a,b; c is missing → 1/3 archived (< 50%, below the guard).
    const stub = await startStub(bulkFeedHandler([
        lbRecord({ id: 'a', name: 'A', status: 'instock' }),
        lbRecord({ id: 'b', name: 'B', status: 'instock' }),
    ]))
    const pb = await startPB({ SYNC_CRON, INTEGRATION_ALLOW_INSECURE_URL: 'true' })
    try {
        const inst = await seedInstitution({ baseUrl: stubUrl(stub), city: 'Stadt' })
        const mk = (ext, name) => seedItem({ name, owner: inst.id, externalId: ext, status: 'available', categories: ['Sonstiges'], description: name, place: 'Stadt' })
        await mk('a', 'A'); await mk('b', 'B')
        const cId = await mk('c', 'Verschwunden')

        await triggerSync()
        const archived = await (async () => {
            for (let i = 0; i < 60; i++) { const r = await getItem(cId); if (r.status === 'unavailable') return r; await sleep(200) }
            return null
        })()
        assert.ok(archived, 'missing item archived')
        assert.equal(archived.description, DESCRIPTION_PREFIX + 'Verschwunden', 'prefix prepended once')

        const s1 = await waitSummary(inst.username)
        await triggerSync()
        // Wait for a second summary line, then re-check idempotency.
        const filter = encodeURIComponent(`message~'${inst.username}:'`)
        for (let i = 0; i < 100; i++) { const r = await api('GET', `/api/logs?perPage=100&filter=${filter}`, adminAuth()); if ((r.json.items || []).length >= 2) break; await sleep(200) }
        const after = await getItem(cId)
        assert.equal(after.description, DESCRIPTION_PREFIX + 'Verschwunden', 'no double prefix on the second run')
        assert.ok(s1, 'first run logged a summary')
    } finally {
        stopPB(pb)
        closeStub(stub)
    }
})

test('4. archive-guard: an empty feed archives NOTHING and records an error', async () => {
    const stub = await startStub(bulkFeedHandler([])) // {items: []}
    const pb = await startPB({ SYNC_CRON, INTEGRATION_ALLOW_INSECURE_URL: 'true' })
    try {
        const inst = await seedInstitution({ baseUrl: stubUrl(stub), city: 'Stadt' })
        const ids = []
        for (let i = 1; i <= 2; i++) ids.push(await seedItem({ name: `I${i}`, owner: inst.id, externalId: `e-${i}`, status: 'available', categories: ['Sonstiges'], description: `I${i}`, place: 'Stadt' }))

        await triggerSync()
        const summary = await waitSummary(inst.username)
        assert.ok(summary, 'a summary is logged')
        assert.equal(summary.fetched, 0, 'empty feed')
        assert.equal(summary.archived, 0, 'nothing archived on empty feed')
        assert.ok(summary.errors >= 1, 'archive-guard error recorded')
        for (const id of ids) {
            const rec = await getItem(id)
            assert.equal(rec.status, 'available', 'item untouched')
            assert.ok(!rec.description.startsWith(DESCRIPTION_PREFIX), 'not archived')
        }
    } finally {
        stopPB(pb)
        closeStub(stub)
    }
})

test('5. archive-guard >=50%: archive phase skipped BUT creates/updates still applied (sync semantics)', async () => {
    // DB has a,b,c,d. Feed returns a,b CHANGED (updates) and omits c,d → would archive 2/4 = 50% → guard skips archive.
    const stub = await startStub(bulkFeedHandler([
        lbRecord({ id: 'a', name: 'A', status: 'instock' }),
        lbRecord({ id: 'b', name: 'B', status: 'instock' }),
    ]))
    const pb = await startPB({ SYNC_CRON, INTEGRATION_ALLOW_INSECURE_URL: 'true' })
    try {
        const inst = await seedInstitution({ baseUrl: stubUrl(stub), city: 'Stadt' })
        const mk = (ext, name) => seedItem({ name, owner: inst.id, externalId: ext, status: 'unavailable', categories: ['Sonstiges'], description: name, place: 'Stadt' })
        const aId = await mk('a', 'A'); await mk('b', 'B')
        const cId = await mk('c', 'C'); const dId = await mk('d', 'D')

        await triggerSync()
        const summary = await waitSummary(inst.username)
        assert.ok(summary, 'a summary is logged')
        assert.equal(summary.updated, 2, 'a,b updated despite the guard')
        assert.equal(summary.archived, 0, 'archive phase skipped')
        assert.ok(summary.errors >= 1, 'guard error recorded')
        assert.equal((await getItem(aId)).status, 'available', 'update applied to a')
        assert.equal((await getItem(cId)).status, 'unavailable', 'c not archived (still original unavailable)')
        assert.ok(!(await getItem(cId)).description.startsWith(DESCRIPTION_PREFIX), 'c has no archive prefix')
        assert.ok(!(await getItem(dId)).description.startsWith(DESCRIPTION_PREFIX), 'd has no archive prefix')
    } finally {
        stopPB(pb)
        closeStub(stub)
    }
})

test('6. pagination: a >200-item feed is pulled across multiple pages', async () => {
    const records = []
    for (let i = 0; i < 250; i++) records.push(lbRecord({ id: `p-${i}`, name: `Item ${i}`, status: 'instock' }))
    const stub = await startStub(bulkFeedHandler(records)) // perPage 200 → 2 pages
    const pb = await startPB({ SYNC_CRON, INTEGRATION_ALLOW_INSECURE_URL: 'true' })
    try {
        const inst = await seedInstitution({ baseUrl: stubUrl(stub), city: 'Stadt' })

        await triggerSync()
        const last = await pollExternal('p-249') // only reachable via page 2
        assert.ok(last, 'a page-2 record was pulled')
        const summary = await waitSummary(inst.username)
        assert.equal(summary.fetched, 250, 'all 250 records fetched across pages')
        assert.equal(summary.created, 250, 'all 250 created')
        assert.equal(await countItems(inst.id), 250, '250 items in the DB')
    } finally {
        stopPB(pb)
        closeStub(stub)
    }
})

test('7. truncated-feed guard: a bogus totalPages aborts the fetch with ZERO writes (no archive)', async () => {
    const stub = await startStub(bulkFeedHandler(
        [lbRecord({ id: 't-1', name: 'T', status: 'instock' })],
        { totalPagesOverride: 100 } // > MAX_PAGES (26) → fetchAllItems throws
    ))
    const pb = await startPB({ SYNC_CRON, INTEGRATION_ALLOW_INSECURE_URL: 'true' })
    try {
        const inst = await seedInstitution({ baseUrl: stubUrl(stub), city: 'Stadt' })
        const keepId = await seedItem({ name: 'Bleibt', owner: inst.id, externalId: 'keep', status: 'available', categories: ['Sonstiges'], description: 'bleibt', place: 'Stadt' })

        await triggerSync()
        const summary = await waitSummary(inst.username)
        assert.ok(summary, 'a summary is logged')
        assert.ok(summary.errors >= 1, 'fetch failure recorded')
        assert.equal(summary.created, 0)
        assert.equal(summary.updated, 0)
        assert.equal(summary.archived, 0, 'no archive on a truncated feed')
        assert.ok(!(await findByExternalId('t-1')), 'partial feed item NOT created (zero writes)')
        const keep = await getItem(keepId)
        assert.equal(keep.status, 'available', 'existing item untouched')
        assert.ok(!keep.description.startsWith(DESCRIPTION_PREFIX), 'existing item not archived')
    } finally {
        stopPB(pb)
        closeStub(stub)
    }
})

test('8. discovery: the full sync processes only leihbackend configs; a WINBIAP config is ignored', async () => {
    const lbA = await startStub(bulkFeedHandler([lbRecord({ id: 'da-1', name: 'A1', status: 'instock' })]))
    const lbB = await startStub(bulkFeedHandler([lbRecord({ id: 'db-1', name: 'B1', status: 'instock' })]))
    let winHits = 0
    const win = await startStub((req, res) => {
        winHits += 1
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ Data: [{ CatalogData: { MediaItemsUnsorted: [{ StatusId: 1 }] } }] }))
    })
    const pb = await startPB({ SYNC_CRON, INTEGRATION_ALLOW_INSECURE_URL: 'true' })
    try {
        const instA = await seedInstitution({ username: 'lba', baseUrl: stubUrl(lbA), city: 'A' })
        const instB = await seedInstitution({ username: 'lbb', baseUrl: stubUrl(lbB), city: 'B' })
        const winInst = await seedInstitution({ username: 'winb', baseUrl: `${stubUrl(win)}/webopac`, city: 'W' })
        const winItemId = await seedItem({ name: 'WinItem', owner: winInst.id, externalId: '118$X', status: 'unknown', categories: ['Bücher'], description: 'w', place: 'W' })

        await triggerSync()
        assert.ok(await pollExternal('da-1'), 'leihbackend A processed')
        assert.ok(await pollExternal('db-1'), 'leihbackend B processed')
        // give the run a beat to fully settle, then assert WINBIAP was never contacted
        await waitSummary(instB.username)
        assert.equal(winHits, 0, 'the WINBIAP WebOPAC must NOT be fetched by the full sync')
        assert.equal((await getItem(winItemId)).status, 'unknown', 'WINBIAP item untouched by the pull')
    } finally {
        stopPB(pb)
        closeStub(lbA); closeStub(lbB); closeStub(win)
    }
})

test('9. enabled=false: a disabled config is skipped; its items are untouched', async () => {
    const stub = await startStub(bulkFeedHandler([lbRecord({ id: 'x-1', name: 'Neu', status: 'instock' })]))
    const pb = await startPB({ SYNC_CRON, INTEGRATION_ALLOW_INSECURE_URL: 'true' })
    try {
        const inst = await seedInstitution({ baseUrl: stubUrl(stub), city: 'Stadt', enabled: false })
        const itemId = await seedItem({ name: 'Alt', owner: inst.id, externalId: 'x-1', status: 'unavailable', categories: ['Sonstiges'], description: 'alt', place: 'Stadt' })

        await triggerSync()
        // No enabled institution → the run reports "no institutions configured".
        assert.ok(await waitLog('no institutions configured'), 'disabled config yields an empty run')
        const item = await getItem(itemId)
        assert.equal(item.status, 'unavailable', 'disabled institution not synced — item unchanged')
    } finally {
        stopPB(pb)
        closeStub(stub)
    }
})

test('10. nameless filter: a feed record with an empty name is dropped, the rest created', async () => {
    const stub = await startStub(bulkFeedHandler([
        lbRecord({ id: 'n-1', name: 'Hat Namen', status: 'instock' }),
        lbRecord({ id: 'n-2', name: '   ', status: 'instock' }), // trims to '' → dropped
    ]))
    const pb = await startPB({ SYNC_CRON, INTEGRATION_ALLOW_INSECURE_URL: 'true' })
    try {
        const inst = await seedInstitution({ baseUrl: stubUrl(stub), city: 'Stadt' })

        await triggerSync()
        assert.ok(await pollExternal('n-1'), 'named record created')
        const summary = await waitSummary(inst.username)
        assert.equal(summary.fetched, 1, 'only the named record counts as fetched')
        assert.equal(summary.created, 1)
        assert.ok(!(await findByExternalId('n-2')), 'nameless record NOT created')
    } finally {
        stopPB(pb)
        closeStub(stub)
    }
})

test('11. per-institution isolation: one institution failing does not stop the others', async () => {
    // Institution A's source errors (HTTP 500) → A aborts with zero writes; institution B is still
    // fully processed. NOTE: the transaction-ROLLBACK of a partial write is covered by the refresh
    // suite (test 5) — it exercises the identical `app.runInTransaction(applyDiff)` code path. The
    // sync mapping cannot inject a write failure via feed data (`name` is the only required synced
    // field and empty names are filtered pre-diff; there is no unique index), so isolation here is
    // driven by a fetch failure, the reachable failure mode for the pull.
    const bad = await startStub(bulkFeedHandler([lbRecord({ id: 'bad-1' })], { status: 500 }))
    const good = await startStub(bulkFeedHandler([lbRecord({ id: 'good-1', name: 'Gut', status: 'instock' })]))
    const pb = await startPB({ SYNC_CRON, INTEGRATION_ALLOW_INSECURE_URL: 'true' })
    try {
        const instA = await seedInstitution({ username: 'insta', baseUrl: stubUrl(bad), city: 'A' })
        const aKeep = await seedItem({ name: 'A behalten', owner: instA.id, externalId: 'a-keep', status: 'available', categories: ['Sonstiges'], description: 'a', place: 'A' })
        const instB = await seedInstitution({ username: 'instb', baseUrl: stubUrl(good), city: 'B' })

        await triggerSync()
        assert.ok(await pollExternal('good-1'), 'sibling institution B is still processed')
        const summaryA = await waitSummary(instA.username)
        assert.ok(summaryA && summaryA.errors >= 1, 'A records its fetch failure')
        assert.equal(summaryA.created, 0, 'A wrote nothing')
        const keep = await getItem(aKeep)
        assert.equal(keep.status, 'available', 'A existing item untouched')
        assert.ok(!keep.description.startsWith(DESCRIPTION_PREFIX), 'A item not archived')
    } finally {
        stopPB(pb)
        closeStub(bad); closeStub(good)
    }
})

test('12. SSRF guard: an http:// baseUrl without the insecure flag fails with zero writes', async () => {
    const stub = await startStub(bulkFeedHandler([lbRecord({ id: 's-1', name: 'Neu', status: 'instock' })]))
    const pb = await startPB({ SYNC_CRON }) // insecure flag deliberately absent
    try {
        const inst = await seedInstitution({ baseUrl: stubUrl(stub), city: 'Stadt' }) // http://127.0.0.1:...
        const itemId = await seedItem({ name: 'Unverändert', owner: inst.id, externalId: 'keep', status: 'available', categories: ['Sonstiges'], description: 'orig', place: 'Stadt' })

        await triggerSync()
        const summary = await waitSummary(inst.username)
        assert.ok(summary, 'a summary is logged')
        assert.ok(summary.errors >= 1, 'guard failure recorded')
        assert.equal(summary.created, 0)
        assert.equal(summary.updated, 0)
        assert.equal(summary.archived, 0)
        assert.ok(!(await findByExternalId('s-1')), 'nothing created (guard blocked the fetch)')
        assert.equal((await getItem(itemId)).status, 'available', 'existing item untouched')
    } finally {
        stopPB(pb)
        closeStub(stub)
    }
})
