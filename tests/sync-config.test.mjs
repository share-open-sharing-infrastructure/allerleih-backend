// sync_config collection (#487 Phase 2): superuser-only access rules, the unique
// (institution, integration) index, and the users.leihbackendUrl → sync_config backfill
// (pb_hooks/services/syncConfig.js, exercised via the guarded POST /api/_test/backfill-sync-config
// route with INTEGRATION_TEST_ROUTE=true — the data migration itself only ever sees an empty users
// table under the harness). Each test boots its own throwaway PocketBase for isolation.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { startPB, stopPB, adminAuth, api, makeUser } from './harness.mjs'

async function seedInstitutionUser(name, fields) {
    const created = await api('POST', '/api/collections/users/records', adminAuth(), Object.assign({
        email: `${name}@test.local`, password: 'test1234', passwordConfirm: 'test1234',
        username: name, isInstitution: true,
    }, fields || {}))
    assert.equal(created.status, 200, `seed ${name}: ${JSON.stringify(created.json)}`)
    return created.json.id
}

async function listConfigs(filter) {
    const q = filter ? `?filter=${encodeURIComponent(filter)}&perPage=200` : '?perPage=200'
    const r = await api('GET', `/api/collections/sync_config/records${q}`, adminAuth())
    assert.equal(r.status, 200, `list sync_config: ${JSON.stringify(r.json)}`)
    return r.json.items
}

test('1. sync_config is superuser-only: a normal user is denied list/view/create; superuser has full CRUD', async () => {
    const pb = await startPB()
    try {
        const inst = await seedInstitutionUser('inst1', { leihbackendUrl: 'https://a.example' })
        const user = await makeUser('normalo')

        // Superuser creates a row (rules are null = superuser-only, adminAuth bypasses them).
        const created = await api('POST', '/api/collections/sync_config/records', adminAuth(),
            { institution: inst, integration: 'leihbackend', baseUrl: 'https://a.example', enabled: true })
        assert.equal(created.status, 200, `superuser create: ${JSON.stringify(created.json)}`)
        const rowId = created.json.id

        // A normal authenticated user must be denied list / view / create.
        const list = await api('GET', '/api/collections/sync_config/records', user.t)
        assert.ok(list.status === 403 || list.status === 404, `normal-user list denied (got ${list.status})`)
        const view = await api('GET', `/api/collections/sync_config/records/${rowId}`, user.t)
        assert.ok(view.status === 403 || view.status === 404, `normal-user view denied (got ${view.status})`)
        const create = await api('POST', '/api/collections/sync_config/records', user.t,
            { institution: inst, integration: 'winbiap', baseUrl: 'https://b.example/webopac', enabled: true })
        assert.ok(create.status === 403 || create.status === 404, `normal-user create denied (got ${create.status})`)

        // Superuser can view / update / delete.
        assert.equal((await api('GET', `/api/collections/sync_config/records/${rowId}`, adminAuth())).status, 200)
        assert.equal((await api('PATCH', `/api/collections/sync_config/records/${rowId}`, adminAuth(), { enabled: false })).status, 200)
        assert.equal((await api('DELETE', `/api/collections/sync_config/records/${rowId}`, adminAuth())).status, 204)
    } finally {
        stopPB(pb)
    }
})

test('2. unique (institution, integration) index rejects a duplicate row', async () => {
    const pb = await startPB()
    try {
        const inst = await seedInstitutionUser('inst2', { leihbackendUrl: 'https://a.example' })
        const first = await api('POST', '/api/collections/sync_config/records', adminAuth(),
            { institution: inst, integration: 'leihbackend', baseUrl: 'https://a.example', enabled: true })
        assert.equal(first.status, 200, `first create: ${JSON.stringify(first.json)}`)

        const dup = await api('POST', '/api/collections/sync_config/records', adminAuth(),
            { institution: inst, integration: 'leihbackend', baseUrl: 'https://other.example', enabled: true })
        assert.equal(dup.status, 400, `duplicate (institution, integration) must be rejected (got ${dup.status})`)

        // A different integration for the SAME institution is allowed.
        const other = await api('POST', '/api/collections/sync_config/records', adminAuth(),
            { institution: inst, integration: 'winbiap', baseUrl: 'https://a.example/webopac', enabled: true })
        assert.equal(other.status, 200, `distinct integration allowed: ${JSON.stringify(other.json)}`)
    } finally {
        stopPB(pb)
    }
})

test('3. backfill creates exactly one config per configured institution, integration + fields derived', async () => {
    const pb = await startPB({ INTEGRATION_TEST_ROUTE: 'true' })
    try {
        const lbId = await seedInstitutionUser('lbinst', {
            leihbackendUrl: 'https://allerlei.uber.space', leihbackendItemUrlTemplate: 'https://allerlei.uber.space/i/{id}',
        })
        const winId = await seedInstitutionUser('wininst', { leihbackendUrl: 'https://rblg.stadt.lueneburg.de/webopac' })
        await seedInstitutionUser('nourlinst', {}) // isInstitution but no leihbackendUrl → not backfilled

        const res = await api('POST', '/api/_test/backfill-sync-config', adminAuth())
        assert.equal(res.status, 200)
        assert.equal(res.json.created, 2, `two configs created: ${JSON.stringify(res.json)}`)
        assert.equal(res.json.scanned, 2, 'only the two URL-configured institutions are scanned')

        const all = await listConfigs()
        assert.equal(all.length, 2, 'exactly two config rows exist')

        const lbCfg = all.find((c) => c.institution === lbId)
        assert.ok(lbCfg, 'leihbackend institution has a config')
        assert.equal(lbCfg.integration, 'leihbackend', 'non-/webopac URL → leihbackend')
        assert.equal(lbCfg.baseUrl, 'https://allerlei.uber.space')
        assert.equal(lbCfg.itemUrlTemplate, 'https://allerlei.uber.space/i/{id}')
        assert.equal(lbCfg.enabled, true, 'backfilled configs are enabled')

        const winCfg = all.find((c) => c.institution === winId)
        assert.ok(winCfg, 'winbiap institution has a config')
        assert.equal(winCfg.integration, 'winbiap', '/webopac URL → winbiap')
        assert.equal(winCfg.baseUrl, 'https://rblg.stadt.lueneburg.de/webopac')
    } finally {
        stopPB(pb)
    }
})

test('4. backfill is idempotent — a second run creates no duplicates', async () => {
    const pb = await startPB({ INTEGRATION_TEST_ROUTE: 'true' })
    try {
        await seedInstitutionUser('lbinst', { leihbackendUrl: 'https://allerlei.uber.space' })
        await seedInstitutionUser('wininst', { leihbackendUrl: 'https://x.example/webopac' })

        const first = await api('POST', '/api/_test/backfill-sync-config', adminAuth())
        assert.equal(first.json.created, 2)

        const second = await api('POST', '/api/_test/backfill-sync-config', adminAuth())
        assert.equal(second.json.created, 0, 'no new rows on the second run')
        assert.equal(second.json.skipped, 2, 'both existing configs skipped')

        assert.equal((await listConfigs()).length, 2, 'still exactly two config rows (no duplicates)')
    } finally {
        stopPB(pb)
    }
})

test('5. deleting an institution user cascade-deletes its sync_config rows', async () => {
    const pb = await startPB()
    try {
        const inst = await seedInstitutionUser('inst5', { leihbackendUrl: 'https://a.example' })
        await api('POST', '/api/collections/sync_config/records', adminAuth(),
            { institution: inst, integration: 'leihbackend', baseUrl: 'https://a.example', enabled: true })
        assert.equal((await listConfigs(`institution="${inst}"`)).length, 1, 'config exists before delete')

        const del = await api('DELETE', `/api/collections/users/records/${inst}`, adminAuth())
        assert.equal(del.status, 204, 'institution user deleted')

        assert.equal((await listConfigs(`institution="${inst}"`)).length, 0, 'config cascade-deleted with the user')
    } finally {
        stopPB(pb)
    }
})
