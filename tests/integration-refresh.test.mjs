// Backend per-item refresh (pb_hooks/integrations/refresh.js, share-mvp#487 Phase 1): the
// refresh cron now runs LOCALLY in the backend instead of POSTing the frontend. Each test boots
// its own throwaway PocketBase (the run processes *all* configured institutions, so a fresh
// instance keeps every case isolated — same pattern as cron-sync-config.test.mjs), seeds an
// institution + external items, stubs the upstream source (leihbackend item_public / WINBIAP
// WebOPAC) on a loopback port (INTEGRATION_ALLOW_INSECURE_URL=true), fires the job via
// POST /api/crons/integration_refresh, and asserts the resulting item state + summary logs.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { setTimeout as sleep } from 'node:timers/promises'
import { startPB, stopPB, adminAuth, api } from './harness.mjs'

const REFRESH_CRON = '*/15 * * * *'
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

/** A leihbackend item_public record (mapping reads id/iid/name/description/status/deposit/images/category/brand/model/parts). */
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

/** leihbackend stub: `items` maps externalId -> record (missing/undefined -> 404 "gone"). */
function leihbackendHandler(items) {
    return (req, res) => {
        const m = req.url.match(/\/api\/collections\/item_public\/records\/([^?]+)/)
        if (m) {
            const id = decodeURIComponent(m[1])
            const rec = Object.prototype.hasOwnProperty.call(items, id) ? items[id] : undefined
            if (!rec) {
                res.writeHead(404, { 'Content-Type': 'application/json' })
                res.end('{"code":404}')
                return
            }
            res.writeHead(200, { 'Content-Type': 'application/json' })
            res.end(JSON.stringify(rec))
            return
        }
        res.writeHead(404)
        res.end('nope')
    }
}

/** WINBIAP WebOPAC stub under /webopac: answers cataloguedata.aspx with one exemplar StatusId. */
function winbiapHandler(statusId) {
    return (req, res) => {
        if (req.url.indexOf('/webopac/service/cataloguedata.aspx') === 0) {
            res.writeHead(200, { 'Content-Type': 'application/json' })
            res.end(JSON.stringify({ Data: [{ CatalogData: { MediaItemsUnsorted: [{ StatusId: statusId }] } }] }))
            return
        }
        res.writeHead(404)
        res.end('nope')
    }
}

// --- seeding + polling helpers ------------------------------------------------------------

let instSeq = 0
/**
 * Seeds an institution user AND (as of #487 Phase 2) its `sync_config` row — the backend cron
 * discovers institutions from `sync_config`, not `users.leihbackendUrl`. Integration is derived
 * from the URL (`/webopac` → winbiap, else leihbackend), mirroring the backfill's `isWinbiapUrl`.
 * `users.leihbackendUrl` is still seeded (dual-truth interim; the frontend manual path uses it).
 */
async function seedInstitution(opts) {
    const t = adminAuth()
    const username = opts.username || `inst${++instSeq}`
    const created = await api('POST', '/api/collections/users/records', t, {
        email: `${username}@test.local`,
        password: 'test1234',
        passwordConfirm: 'test1234',
        username,
        isInstitution: true,
        city: opts.city || '',
    })
    assert.equal(created.status, 200, `seed institution ${username}: ${JSON.stringify(created.json)}`)
    const id = created.json.id

    const integration = /\/webopac/i.test(opts.leihbackendUrl || '') ? 'winbiap' : 'leihbackend'
    const cfg = await api('POST', '/api/collections/sync_config/records', t, {
        institution: id,
        integration,
        baseUrl: opts.leihbackendUrl,
        itemUrlTemplate: opts.urlTemplate || '',
        enabled: opts.enabled === false ? false : true,
    })
    assert.equal(cfg.status, 200, `seed sync_config ${username}: ${JSON.stringify(cfg.json)}`)
    return { id, username }
}

async function seedItem(fields) {
    const created = await api('POST', '/api/collections/items/records', adminAuth(), fields)
    assert.equal(created.status, 200, `seed item: ${JSON.stringify(created.json)}`)
    return created.json.id
}

async function triggerRefresh() {
    const run = await api('POST', '/api/crons/integration_refresh', adminAuth())
    assert.equal(run.status, 204, 'triggering integration_refresh must return 204')
}

async function getItem(id) {
    const r = await api('GET', `/api/collections/items/records/${id}`, adminAuth())
    return r.json
}

/** Polls one item until `predicate(record)` holds; returns the record or null on timeout. */
async function pollItem(id, predicate, tries = 60) {
    for (let i = 0; i < tries; i++) {
        const rec = await getItem(id)
        if (rec && rec.id && predicate(rec)) return rec
        await sleep(200)
    }
    return null
}

/** Waits for the per-institution summary log line and returns its parsed counts + raw entry. */
async function waitSummary(username, tries = 100) {
    const filter = encodeURIComponent(`message~'${username}:'`)
    for (let i = 0; i < tries; i++) {
        const res = await api('GET', `/api/logs?perPage=50&sort=-created&filter=${filter}`, adminAuth())
        const items = res.json.items || []
        if (items.length) return parseSummary(items[0])
        await sleep(200)
    }
    return null
}

/** Counts summary log lines for one institution (to detect a second run completing). */
async function countSummaries(username) {
    const filter = encodeURIComponent(`message~'${username}:'`)
    const res = await api('GET', `/api/logs?perPage=100&filter=${filter}`, adminAuth())
    return (res.json.items || []).length
}
async function waitSummaryCount(username, want, tries = 100) {
    for (let i = 0; i < tries; i++) {
        if ((await countSummaries(username)) >= want) return true
        await sleep(200)
    }
    return false
}

function parseSummary(entry) {
    const m = /fetched=(\d+) created=(\d+) updated=(\d+) archived=(\d+) skipped=(\d+) errors=(\d+)/.exec(entry.message)
    assert.ok(m, `summary line not parseable: ${entry.message}`)
    return {
        message: entry.message,
        level: entry.level,
        data: entry.data,
        fetched: +m[1], created: +m[2], updated: +m[3], archived: +m[4], skipped: +m[5], errors: +m[6],
    }
}

// --- tests --------------------------------------------------------------------------------

test('1. happy path: changed status updates the item; owner/trusteesOnly preserved', async () => {
    const stub = await startStub(leihbackendHandler({
        'lb-1': lbRecord({ id: 'lb-1', iid: 42, name: 'Bohrmaschine', status: 'instock', category: ['heimwerken'] }),
    }))
    const pb = await startPB({ REFRESH_CRON, INTEGRATION_ALLOW_INSECURE_URL: 'true' })
    try {
        const inst = await seedInstitution({ leihbackendUrl: stubUrl(stub), city: 'Musterstadt', urlTemplate: `${stubUrl(stub)}/i/{id}` })
        const itemId = await seedItem({
            name: 'Alter Name', owner: inst.id, externalId: 'lb-1', status: 'unavailable',
            categories: ['Sonstiges'], description: 'alt', place: 'Alt', trusteesOnly: true,
        })

        await triggerRefresh()
        const updated = await pollItem(itemId, (r) => r.status === 'available')
        assert.ok(updated, 'item should be updated to available')
        assert.equal(updated.name, 'Bohrmaschine', 'name re-mapped from source')
        assert.deepEqual(updated.categories, ['Werkzeug und Garten'], 'category mapped heimwerken -> Werkzeug und Garten')
        assert.equal(updated.place, 'Musterstadt', 'place from institution city')
        assert.equal(updated.trusteesOnly, true, 'trusteesOnly must NOT be reset (synced-fields projection)')
        assert.equal(updated.owner, inst.id, 'owner must be preserved')
    } finally {
        stopPB(pb)
        closeStub(stub)
    }
})

test('2. archive on gone: exactly the missing item is archived; second run is idempotent', async () => {
    // 1 of 3 gone => 33% < 50%, below the circuit-breaker.
    const stub = await startStub(leihbackendHandler({
        'g-1': lbRecord({ id: 'g-1', name: 'Bleibt A', status: 'instock', category: ['sonstige'] }),
        'g-2': lbRecord({ id: 'g-2', name: 'Bleibt B', status: 'instock', category: ['sonstige'] }),
        // g-3 absent => 404 => gone
    }))
    const pb = await startPB({ REFRESH_CRON, INTEGRATION_ALLOW_INSECURE_URL: 'true' })
    try {
        const inst = await seedInstitution({ leihbackendUrl: stubUrl(stub), city: 'Stadt' })
        const mk = (ext, name) => seedItem({
            name, owner: inst.id, externalId: ext, status: 'available', categories: ['Sonstiges'],
            description: name, place: 'Stadt',
        })
        await mk('g-1', 'Bleibt A')
        await mk('g-2', 'Bleibt B')
        const goneId = await mk('g-3', 'Verschwundenes Ding')

        await triggerRefresh()
        const archived = await pollItem(goneId, (r) => r.status === 'unavailable')
        assert.ok(archived, 'the gone item should be archived (unavailable)')
        assert.ok(archived.description.startsWith(DESCRIPTION_PREFIX), 'archived description carries the prefix')
        assert.equal(archived.description, DESCRIPTION_PREFIX + 'Verschwundenes Ding', 'prefix prepended once, original kept')

        // Second run: g-3 already archived => skip, no double prefix.
        const before = await countSummaries(inst.username)
        await triggerRefresh()
        assert.ok(await waitSummaryCount(inst.username, before + 1), 'second run should log a summary')
        const after = await getItem(goneId)
        assert.equal(after.description, DESCRIPTION_PREFIX + 'Verschwundenes Ding', 'no double prefix on the second run')
        assert.equal(after.status, 'unavailable', 'still archived')
    } finally {
        stopPB(pb)
        closeStub(stub)
    }
})

test('3. circuit-breaker: >=50% gone/errors archives NOTHING and logs an abort', async () => {
    // All 4 items gone => 100% >= 50% => breaker trips.
    const stub = await startStub(leihbackendHandler({})) // every id -> 404
    const pb = await startPB({ REFRESH_CRON, INTEGRATION_ALLOW_INSECURE_URL: 'true' })
    try {
        const inst = await seedInstitution({ leihbackendUrl: stubUrl(stub), city: 'Stadt' })
        const ids = []
        for (let i = 1; i <= 4; i++) {
            ids.push(await seedItem({
                name: `Item ${i}`, owner: inst.id, externalId: `cb-${i}`, status: 'available',
                categories: ['Sonstiges'], description: `Item ${i}`, place: 'Stadt',
            }))
        }

        await triggerRefresh()
        const summary = await waitSummary(inst.username)
        assert.ok(summary, 'a summary must be logged')
        assert.equal(summary.archived, 0, 'circuit-breaker: nothing archived')
        assert.equal(summary.updated, 0, 'nothing updated')
        assert.equal(summary.errors, 1, 'exactly the abort line is recorded as an error')
        assert.equal(summary.level, 8, 'summary with errors logs at error level')
        if (summary.data && summary.data.errors) {
            assert.ok(String(summary.data.errors).includes('Aborted'), 'abort reason present in the log data')
        }
        // Every item untouched (still available, no prefix).
        for (const id of ids) {
            const rec = await getItem(id)
            assert.equal(rec.status, 'available', 'item status unchanged by the aborted run')
            assert.ok(!rec.description.startsWith(DESCRIPTION_PREFIX), 'item not archived')
        }
    } finally {
        stopPB(pb)
        closeStub(stub)
    }
})

test('4. routing safety: the leihbackend catch-all never claims a WINBIAP item', async () => {
    // WINBIAP institution (base ends /webopac) with a barcode item, alongside a leihbackend one.
    const winbiap = await startStub(winbiapHandler(1)) // StatusId 1 => available
    const lb = await startStub(leihbackendHandler({
        'lb-x': lbRecord({ id: 'lb-x', name: 'Leihbackend Ding', status: 'instock', category: ['sonstige'] }),
    }))
    const pb = await startPB({ REFRESH_CRON, INTEGRATION_ALLOW_INSECURE_URL: 'true' })
    try {
        const winst = await seedInstitution({ username: 'winbiapinst', leihbackendUrl: `${stubUrl(winbiap)}/webopac`, city: 'Lüneburg' })
        const linst = await seedInstitution({ username: 'lbinst', leihbackendUrl: stubUrl(lb), city: 'Stadt' })

        const winItem = await seedItem({
            name: 'WebOPAC Buch', owner: winst.id, externalId: '118$5031208P', status: 'unknown',
            categories: ['Bücher'], description: 'Buch', place: 'Lüneburg',
        })
        const lbItem = await seedItem({
            name: 'Alt', owner: linst.id, externalId: 'lb-x', status: 'unavailable',
            categories: ['Sonstiges'], description: 'alt', place: 'Stadt',
        })

        await triggerRefresh()
        const win = await pollItem(winItem, (r) => r.status === 'available')
        assert.ok(win, 'WINBIAP item refreshed to available by the winbiap integration')
        assert.ok(!win.description.startsWith(DESCRIPTION_PREFIX), 'WINBIAP item must NOT be archived by the catch-all')
        assert.equal(win.name, 'WebOPAC Buch', 'WINBIAP refresh is status-only — name untouched')

        const lbUpdated = await pollItem(lbItem, (r) => r.status === 'available')
        assert.ok(lbUpdated, 'the leihbackend item is processed by leihbackend')
        assert.equal(lbUpdated.name, 'Leihbackend Ding', 'leihbackend item re-mapped')
    } finally {
        stopPB(pb)
        closeStub(winbiap)
        closeStub(lb)
    }
})

test('5. transaction rollback isolates a failing institution; siblings still run', async () => {
    // Institution A: source returns an EMPTY name => update violates the required `name` field =>
    // the whole institution's write transaction rolls back. Institution B updates cleanly.
    const stub = await startStub(leihbackendHandler({
        'rb-bad': lbRecord({ id: 'rb-bad', name: '', status: 'instock', category: ['sonstige'] }),
        'rb-good': lbRecord({ id: 'rb-good', name: 'Gut', status: 'instock', category: ['sonstige'] }),
    }))
    const pb = await startPB({ REFRESH_CRON, INTEGRATION_ALLOW_INSECURE_URL: 'true' })
    try {
        const instA = await seedInstitution({ username: 'insta', leihbackendUrl: stubUrl(stub), city: 'A' })
        const instB = await seedInstitution({ username: 'instb', leihbackendUrl: stubUrl(stub), city: 'B' })
        const aItem = await seedItem({
            name: 'Original A', owner: instA.id, externalId: 'rb-bad', status: 'unavailable',
            categories: ['Sonstiges'], description: 'orig a', place: 'A',
        })
        const bItem = await seedItem({
            name: 'Original B', owner: instB.id, externalId: 'rb-good', status: 'unavailable',
            categories: ['Sonstiges'], description: 'orig b', place: 'B',
        })

        await triggerRefresh()

        // B is the healthy sibling — wait for it, which also proves the run reached B despite A failing.
        const b = await pollItem(bItem, (r) => r.status === 'available')
        assert.ok(b, 'sibling institution B is still processed')
        assert.equal(b.name, 'Gut', 'B re-mapped cleanly')

        const a = await getItem(aItem)
        assert.equal(a.name, 'Original A', 'A must be fully unchanged (transaction rolled back)')
        assert.equal(a.status, 'unavailable', 'A status unchanged')

        const summaryA = await waitSummary(instA.username)
        assert.ok(summaryA && summaryA.errors >= 1, 'institution A records the failed write as an error')
        assert.equal(summaryA.updated, 0, 'A wrote nothing')
    } finally {
        stopPB(pb)
        closeStub(stub)
    }
})

test('6. misconfig guards: invalid REFRESH_CRON stays unregistered, sync unaffected; refresh needs no frontend config', async () => {
    // (a) invalid REFRESH_CRON must not register, and must not block a valid integration_sync.
    let pb = await startPB({
        REFRESH_CRON: 'not-a-cron',
        SYNC_CRON: '*/30 * * * *',
        FRONTEND_URL: 'http://127.0.0.1:9', // registration only; never called
        SYNC_SECRET: 'test-sync-secret',
    })
    try {
        const res = await api('GET', '/api/crons', adminAuth())
        const ids = res.json.map((j) => j.id)
        assert.ok(!ids.includes('integration_refresh'), `invalid REFRESH_CRON must not register (got ${ids})`)
        assert.ok(ids.includes('integration_sync'), `a bad REFRESH_CRON must not block integration_sync (got ${ids})`)
    } finally {
        stopPB(pb)
    }

    // (b) refresh registers on a valid REFRESH_CRON alone — no FRONTEND_URL / SYNC_SECRET needed
    //     now that it runs locally.
    pb = await startPB({ REFRESH_CRON })
    try {
        const res = await api('GET', '/api/crons', adminAuth())
        const ids = res.json.map((j) => j.id)
        assert.ok(ids.includes('integration_refresh'), 'refresh registers with only REFRESH_CRON set')
        assert.ok(!ids.includes('integration_sync'), 'sync stays unregistered without SYNC_CRON')
    } finally {
        stopPB(pb)
    }
})

test('7. SSRF guard: an http:// base URL without the insecure flag fails with zero writes', async () => {
    // No INTEGRATION_ALLOW_INSECURE_URL => the guard rejects the loopback http:// base URL.
    const stub = await startStub(leihbackendHandler({
        'ssrf-1': lbRecord({ id: 'ssrf-1', name: 'Nie erreicht', status: 'instock' }),
    }))
    const pb = await startPB({ REFRESH_CRON }) // insecure flag deliberately absent
    try {
        const inst = await seedInstitution({ leihbackendUrl: stubUrl(stub), city: 'Stadt' }) // http://127.0.0.1:...
        const itemId = await seedItem({
            name: 'Unverändert', owner: inst.id, externalId: 'ssrf-1', status: 'available',
            categories: ['Sonstiges'], description: 'orig', place: 'Stadt',
        })

        await triggerRefresh()
        const summary = await waitSummary(inst.username)
        assert.ok(summary, 'a summary must be logged')
        assert.ok(summary.errors >= 1, 'the guard failure is recorded as an error')
        assert.equal(summary.updated, 0, 'zero updates')
        assert.equal(summary.created, 0, 'zero creates')
        assert.equal(summary.archived, 0, 'zero archives')

        const item = await getItem(itemId)
        assert.equal(item.name, 'Unverändert', 'item untouched by the rejected run')
        assert.equal(item.status, 'available', 'item status unchanged')
    } finally {
        stopPB(pb)
        closeStub(stub)
    }
})

test('8. diff edge cases: unchanged, category reorder, and already-archived all skip', async () => {
    const base = { city: 'EdgeCity' }
    const stub = await startStub(leihbackendHandler({
        // Unchanged: mapItem output equals the seeded values below.
        'e-u': lbRecord({ id: 'e-u', iid: 1, name: 'Ding', description: '', status: 'instock', category: ['sonstige'] }),
        // Category reorder: maps to ['Für Kinder','Küche']; seeded reversed => order-independent skip.
        'e-c': lbRecord({ id: 'e-c', iid: 2, name: 'Kinderkueche', description: '', status: 'instock', category: ['kinder', 'küche'] }),
        // e-a absent => gone, but seeded as already-archived => skip (no re-archive).
    }))
    const pb = await startPB({ REFRESH_CRON, INTEGRATION_ALLOW_INSECURE_URL: 'true' })
    try {
        const template = `${stubUrl(stub)}/i/{id}`
        const inst = await seedInstitution({ leihbackendUrl: stubUrl(stub), city: base.city, urlTemplate: template })

        // Seed to exactly match mapItem's deterministic output (no images => externalImgUrl '';
        // empty description + iid => "Inventarnummer: N"; externalUrl from template).
        await seedItem({
            name: 'Ding', owner: inst.id, externalId: 'e-u', status: 'available', categories: ['Sonstiges'],
            description: 'Inventarnummer: 1', place: base.city, externalUrl: `${stubUrl(stub)}/i/e-u`, externalImgUrl: '',
        })
        await seedItem({
            name: 'Kinderkueche', owner: inst.id, externalId: 'e-c', status: 'available',
            categories: ['Küche', 'Für Kinder'], // reversed vs. mapItem's ['Für Kinder','Küche']
            description: 'Inventarnummer: 2', place: base.city, externalUrl: `${stubUrl(stub)}/i/e-c`, externalImgUrl: '',
        })
        const archivedId = await seedItem({
            name: 'Weg', owner: inst.id, externalId: 'e-a', status: 'unavailable',
            categories: ['Sonstiges'], description: DESCRIPTION_PREFIX + 'Weg', place: base.city,
        })

        await triggerRefresh()
        const summary = await waitSummary(inst.username)
        assert.ok(summary, 'a summary must be logged')
        assert.equal(summary.fetched, 2, 'two items found (e-u, e-c); e-a is gone')
        assert.equal(summary.updated, 0, 'unchanged + reordered-categories items are NOT updated')
        assert.equal(summary.archived, 0, 'the already-archived gone item is not re-archived')
        assert.equal(summary.skipped, 3, 'all three items skipped')
        assert.equal(summary.errors, 0, 'no errors on a clean skip-only run')

        const a = await getItem(archivedId)
        assert.equal(a.description, DESCRIPTION_PREFIX + 'Weg', 'already-archived description unchanged (single prefix)')
    } finally {
        stopPB(pb)
        closeStub(stub)
    }
})
