// sync_config collection (#487): superuser-only access rules, the unique (institution, integration)
// index, and cascadeDelete with the owning institution. Each test boots its own throwaway
// PocketBase for isolation.
//
// NOTE: the one-time `users.leihbackendUrl` → sync_config backfill (services/syncConfig.js, data
// migration 1784658387) is no longer runtime-testable — Phase 3 removed the `users.leihbackendUrl`
// source field, so there is nothing to backfill from at runtime. The migration itself still applies
// (it runs before the field-removal migration) and the historical Phase-2 tests covered the copy.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { startPB, stopPB, adminAuth, api, makeUser } from './harness.mjs'

async function seedInstitutionUser(name) {
    const created = await api('POST', '/api/collections/users/records', adminAuth(), {
        email: `${name}@test.local`, password: 'test1234', passwordConfirm: 'test1234',
        username: name, isInstitution: true,
    })
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
        const inst = await seedInstitutionUser('inst1')
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
        const inst = await seedInstitutionUser('inst2')
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

test('3. deleting an institution user cascade-deletes its sync_config rows', async () => {
    const pb = await startPB()
    try {
        const inst = await seedInstitutionUser('inst5')
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
