// Integration-test harness for the AllerLeih PocketBase backend.
//
// Spins up a REAL PocketBase instance against a THROWAWAY data dir on its own
// port, so every run applies pb_migrations/ from scratch and loads pb_hooks/ —
// i.e. the tests exercise the actual migrations, collection rules and hooks
// end-to-end, which can't be unit-tested (they run server-side in PocketBase).
//
// No external dependencies: Node's built-in fetch + child_process.

import { spawn, spawnSync } from 'node:child_process'
import { rmSync } from 'node:fs'
import { setTimeout as sleep } from 'node:timers/promises'

const PORT = 8091 // separate from the dev instance (8090)
const DIR = './pb_test_data' // throwaway; never the real pb_data
const ADMIN = { email: 'admin@test.local', password: 'TestAdmin1234!' }
export const BASE = `http://127.0.0.1:${PORT}`

let adminToken = null

/** fetch wrapper -> { status, json }. Pass an auth token to send Authorization. */
export async function api(method, path, token, body) {
	const res = await fetch(BASE + path, {
		method,
		headers: {
			'Content-Type': 'application/json',
			...(token ? { Authorization: token } : {}),
		},
		body: body !== undefined ? JSON.stringify(body) : undefined,
	})
	const text = await res.text()
	return { status: res.status, json: text ? JSON.parse(text) : {} }
}

async function waitForHealth(tries = 60) {
	for (let i = 0; i < tries; i++) {
		try {
			const r = await fetch(BASE + '/api/health')
			if (r.ok) return
		} catch {
			/* not up yet */
		}
		await sleep(250)
	}
	throw new Error(`PocketBase did not become healthy on ${BASE}`)
}

/**
 * Start a fresh PocketBase: wipe the test dir, create the superuser (this also
 * applies migrations), serve, and authenticate as superuser for seeding.
 * Returns the child process — pass it to stopPB() in an after() hook.
 *
 * @param {Record<string, string>} extraEnv - Extra environment variables for the
 *   server process (e.g. SYNC_CRON for the integration-sync cron tests).
 */
export async function startPB(extraEnv = {}) {
	rmSync(DIR, { recursive: true, force: true })

	const up = spawnSync(
		'./pocketbase',
		['superuser', 'upsert', ADMIN.email, ADMIN.password, `--dir=${DIR}`],
		{ encoding: 'utf8' }
	)
	if (up.status !== 0) {
		throw new Error('superuser upsert failed: ' + (up.stderr || up.stdout || up.status))
	}

	let stderr = ''
	const proc = spawn('./pocketbase', ['serve', `--http=127.0.0.1:${PORT}`, `--dir=${DIR}`], {
		stdio: ['ignore', 'ignore', 'pipe'],
		// Small page size so cascade tests with a handful of items still exercise
		// the multi-page offset loop in the group-delete fixup hook.
		env: { ...process.env, GROUP_FIXUP_PAGE: '3', ...extraEnv },
	})
	proc.stderr.on('data', (d) => (stderr += d.toString()))

	try {
		await waitForHealth()
	} catch (e) {
		proc.kill('SIGKILL')
		throw new Error(e.message + (stderr ? `\n--- pocketbase stderr ---\n${stderr}` : ''))
	}

	const auth = await api('POST', '/api/collections/_superusers/auth-with-password', null, {
		identity: ADMIN.email,
		password: ADMIN.password,
	})
	if (auth.status !== 200) throw new Error('superuser auth failed: ' + JSON.stringify(auth.json))
	adminToken = auth.json.token

	return proc
}

/**
 * The seeded superuser token, for operations that must bypass collection rules
 * in test setup/teardown (e.g. deleting a user account to exercise cascades).
 */
export function adminAuth() {
	return adminToken
}

/** Kill the instance and remove the throwaway data dir. */
export function stopPB(proc) {
	if (proc) proc.kill('SIGKILL')
	// Retry EBUSY/EPERM: on Windows the SQLite file locks outlive the kill briefly.
	rmSync(DIR, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 })
}

/**
 * Create a verified user (as superuser) and log in.
 * Returns { id, username, t } where `t` is the user's auth token.
 * Usernames must be >= 3 chars (users collection constraint).
 */
export async function makeUser(username) {
	const password = 'test1234'
	const email = `${username}@test.local`

	const created = await api('POST', '/api/collections/users/records', adminToken, {
		email,
		password,
		passwordConfirm: password,
		username,
	})
	if (created.status !== 200) {
		throw new Error(`create user ${username} failed: ` + JSON.stringify(created.json))
	}

	const auth = await api('POST', '/api/collections/users/auth-with-password', null, {
		identity: email,
		password,
	})
	if (auth.status !== 200) {
		throw new Error(`auth user ${username} failed: ` + JSON.stringify(auth.json))
	}

	return { id: created.json.id, username, t: auth.json.token }
}
