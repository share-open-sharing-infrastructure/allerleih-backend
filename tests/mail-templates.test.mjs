// Auth-mail template hosts (#447): the `users` verification / email-change / password-reset
// templates must link to the SvelteKit FRONTEND pages (not the PocketBase `/_/#/...` admin UI, and
// not the old hard-coded https://allerleih.org). Two cooperating pieces:
//   - the migration resolves the host to FRONTEND_URL (or the `{APP_URL}` fallback) — this makes the
//     FIRST serve correct, because `onBootstrap` hooks run *before* pb_migrations are applied;
//   - the auth_mail_templates.pb.js bootstrap hook re-applies FRONTEND_URL on every *subsequent*
//     start, so a changed FRONTEND_URL is picked up on restart without a new migration.
// The `_superusers` templates must stay on the admin-UI `/_/#/...` links, untouched.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawn, spawnSync } from 'node:child_process'
import { rmSync } from 'node:fs'
import { setTimeout as sleep } from 'node:timers/promises'
import { startPB, stopPB, adminAuth, api } from './harness.mjs'

async function getCollection(nameOrId) {
	const res = await api('GET', `/api/collections/${nameOrId}`, adminAuth())
	assert.equal(res.status, 200, `read ${nameOrId} failed: ${JSON.stringify(res.json)}`)
	return res.json
}

const USER_PATHS = {
	verificationTemplate: '/auth/confirm-verification?token=',
	confirmEmailChangeTemplate: '/auth/confirm-email-change?token=',
	resetPasswordTemplate: '/auth/reset/confirm?token=',
}

function assertSuperusersUntouched(superusers, forbiddenHost) {
	for (const field of Object.keys(USER_PATHS)) {
		assert.ok(
			superusers[field].body.includes('/_/#/'),
			`_superusers ${field} must keep its admin-UI "/_/#/" link`
		)
		if (forbiddenHost) {
			assert.ok(
				!superusers[field].body.includes(forbiddenHost),
				`_superusers ${field} must not be rewritten to the frontend host`
			)
		}
	}
}

test('users auth-mail templates use frontend paths, never admin-UI or allerleih.org (baseline, no FRONTEND_URL)', async () => {
	const pb = await startPB({ FRONTEND_URL: '' }) // override any ambient value → {APP_URL} baseline
	try {
		const users = await getCollection('users')

		for (const [field, path] of Object.entries(USER_PATHS)) {
			const body = users[field].body
			assert.ok(body.includes(path), `${field} must contain "${path}" (got: ${body})`)
			assert.ok(!body.includes('/_/#/'), `${field} must not contain the admin-UI path "/_/#/"`)
			assert.ok(!body.includes('allerleih.org'), `${field} must not hard-code allerleih.org`)
			// With FRONTEND_URL unset the migration writes the {APP_URL} fallback host.
			assert.ok(body.includes('{APP_URL}' + path), `${field} must use the {APP_URL} fallback host`)
			// The PocketBase token placeholder must be preserved.
			assert.ok(body.includes('{TOKEN}'), `${field} must keep the {TOKEN} placeholder`)
		}

		assertSuperusersUntouched(await getCollection('_superusers'))
	} finally {
		stopPB(pb)
	}
})

test('a fresh serve with FRONTEND_URL set resolves the host to FRONTEND_URL (via the migration)', async () => {
	const FRONTEND_URL = 'https://fe.example.test'
	const pb = await startPB({ FRONTEND_URL })
	try {
		const users = await getCollection('users')

		for (const [field, path] of Object.entries(USER_PATHS)) {
			const body = users[field].body
			assert.ok(
				body.includes(FRONTEND_URL + path),
				`${field} must use the FRONTEND_URL host (got: ${body})`
			)
			assert.ok(!body.includes('{APP_URL}'), `${field} must no longer contain the {APP_URL} placeholder`)
			assert.ok(!body.includes('/_/#/'), `${field} must not contain the admin-UI path "/_/#/"`)
			assert.ok(body.includes('{TOKEN}'), `${field} must keep the {TOKEN} placeholder`)
		}

		assertSuperusersUntouched(await getCollection('_superusers'), FRONTEND_URL)
	} finally {
		stopPB(pb)
	}
})

// The bootstrap hook is what keeps the host in sync on restarts. Prove it directly: serve once with
// no FRONTEND_URL (migration bakes the {APP_URL} fallback), then restart the SAME data dir with
// FRONTEND_URL set — only the hook can rewrite the already-migrated templates to the new host.
test('the bootstrap hook rewrites the host on restart when FRONTEND_URL changes', async () => {
	const PORT = 8092 // distinct from the shared harness port (8091)
	const DIR = './pb_test_data_restart'
	const BASE = `http://127.0.0.1:${PORT}`
	const ADMIN = { email: 'admin@test.local', password: 'TestAdmin1234!' }
	const FRONTEND_URL = 'https://restart.example.test'

	rmSync(DIR, { recursive: true, force: true })
	const up = spawnSync(
		'./pocketbase',
		['superuser', 'upsert', ADMIN.email, ADMIN.password, `--dir=${DIR}`],
		{ encoding: 'utf8' }
	)
	assert.equal(up.status, 0, 'superuser upsert failed: ' + (up.stderr || up.stdout))

	async function serveOnce(extraEnv) {
		const proc = spawn('./pocketbase', ['serve', `--http=127.0.0.1:${PORT}`, `--dir=${DIR}`], {
			stdio: ['ignore', 'ignore', 'ignore'],
			env: { ...process.env, ...extraEnv },
		})
		try {
			for (let i = 0; i < 60; i++) {
				try {
					if ((await fetch(BASE + '/api/health')).ok) break
				} catch {
					/* not up yet */
				}
				await sleep(250)
			}
			// Give the (post-migration) bootstrap hook a moment to run its save on the 2nd serve.
			await sleep(500)
			const auth = await fetch(BASE + '/api/collections/_superusers/auth-with-password', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ identity: ADMIN.email, password: ADMIN.password }),
			}).then((r) => r.json())
			const users = await fetch(BASE + '/api/collections/users', {
				headers: { Authorization: auth.token },
			}).then((r) => r.json())
			const superusers = await fetch(BASE + '/api/collections/_superusers', {
				headers: { Authorization: auth.token },
			}).then((r) => r.json())
			return { users, superusers }
		} finally {
			proc.kill('SIGKILL')
			await sleep(300)
		}
	}

	try {
		// Serve #1: no FRONTEND_URL → migration bakes the {APP_URL} fallback.
		const first = await serveOnce({ FRONTEND_URL: '' })
		assert.ok(
			first.users.verificationTemplate.body.includes('{APP_URL}/auth/confirm-verification?token='),
			'serve #1 must leave the {APP_URL} fallback host'
		)

		// Serve #2: FRONTEND_URL set, migration already applied → only the hook can rewrite the host.
		const second = await serveOnce({ FRONTEND_URL })
		for (const [field, path] of Object.entries(USER_PATHS)) {
			assert.ok(
				second.users[field].body.includes(FRONTEND_URL + path),
				`serve #2: ${field} must be rewritten to FRONTEND_URL by the hook (got: ${second.users[field].body})`
			)
			assert.ok(
				!second.users[field].body.includes('{APP_URL}'),
				`serve #2: ${field} must no longer contain the {APP_URL} placeholder`
			)
		}
		assertSuperusersUntouched(second.superusers, FRONTEND_URL)
	} finally {
		rmSync(DIR, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 })
	}
})
