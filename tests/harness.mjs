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
import { startSink } from './smtpSink.mjs'

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
 * #607 mail-deliverability tests (digest.test.mjs, mail-deliverability.test.mjs,
 * unsubscribe.test.mjs, ...) all need a real SMTP sink PLUS the same ~10-line env block: point
 * SMTP at the sink (no AUTH/STARTTLS — see smtpSink.mjs), DRY_MODE off, and the digest pacing
 * vars zeroed so a run is instant. Extracted here (#607 review S4) so a new pacing/env var only
 * needs to be added in one place instead of drifting across every test file that copied it.
 *
 * @param {Record<string, string>} extraEnv - Merged over the defaults (e.g. FRONTEND_URL/APP_URL,
 *   DIGEST_TEST_ROUTE, UNSUBSCRIBE_SECRET) — passed through to startPB() untouched, so an
 *   explicit `SMTP_HOST`/`SMTP_PORT` here would still win over the sink if ever needed.
 * @returns {Promise<{pb: import('node:child_process').ChildProcess, sink: Awaited<ReturnType<typeof startSink>>}>}
 */
export async function startPbWithSmtpSink(extraEnv = {}) {
	const sink = await startSink()
	const pb = await startPB({
		SMTP_HOST: '127.0.0.1',
		SMTP_PORT: String(sink.port),
		SMTP_USERNAME: '',
		SMTP_PASSWORD: '',
		SMTP_TLS: 'false',
		DRY_MODE: 'false',
		DIGEST_PACING_MS: '0',
		DIGEST_BATCH_SIZE: '0',
		DIGEST_BATCH_PAUSE_MS: '0',
		...extraEnv,
	})
	return { pb, sink }
}

/**
 * Extract a header's value from a raw MIME message, joining any folded continuation lines (a
 * header value that wraps onto subsequent lines starting with a space/tab, per RFC 5322 §2.2.3)
 * into one string. #607 review S4: this is the one shared `headerValue()` — it used to be defined
 * twice (mail-deliverability.test.mjs and unsubscribe.test.mjs), and the unsubscribe.test.mjs copy
 * didn't handle folded lines at all.
 */
export function headerValue(raw, name) {
	const re = new RegExp(`^${name}:\\s*(.+(?:\\r\\n[ \\t].+)*)`, 'im')
	const m = raw.match(re)
	return m ? m[1].replace(/\r\n[ \t]/g, ' ').trim() : null
}

/**
 * Extract the body of the first MIME part whose Content-Type starts with `mime` (best-effort:
 * relies on the mailer always separating a part's own headers from its body with a blank line,
 * and delimiting parts with a "\r\n--boundary" line — true for every message this mailer builds).
 * #622: lifted out of mail-deliverability.test.mjs (mirrors #607's `headerValue` extraction) so
 * digest-images.test.mjs can decode the digest HTML part too, without duplicating it.
 */
export function extractPart(raw, mime) {
	const idx = raw.indexOf(`Content-Type: ${mime}`)
	if (idx === -1) return null
	const headerEnd = raw.indexOf('\r\n\r\n', idx)
	if (headerEnd === -1) return null
	const bodyStart = headerEnd + 4
	const nextBoundary = raw.indexOf('\r\n--', bodyStart)
	return raw.slice(bodyStart, nextBoundary === -1 ? raw.length : nextBoundary)
}

/**
 * Minimal quoted-printable decoder for asserting on URL substrings: the mailer wraps encoded
 * lines at ~76 chars with a soft "=\r\n" break, which can otherwise split a URL mid-string and
 * make a plain substring check flaky. Only used for positive presence checks — a "must NOT
 * contain X" check stays on the raw text (a false negative there would only hide a regression,
 * never fail a passing run). #622: lifted out of mail-deliverability.test.mjs alongside extractPart.
 */
export function decodeQuotedPrintable(str) {
	return str.replace(/=\r\n/g, '').replace(/=([0-9A-Fa-f]{2})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
}

/**
 * Poll `sink.messages` until at least `min` have arrived (mail send happens in-process during the
 * triggering request, but poll instead of assuming synchronous ordering across the network).
 * #622: lifted out of mail-deliverability.test.mjs — same "second consumer" rationale as
 * extractPart/decodeQuotedPrintable above (digest-images.test.mjs needs it too). Takes `sink`
 * explicitly since, unlike the test file it came from, this module has no local to close over.
 */
export async function waitForMessageCount(sink, min, timeoutMs = 5000) {
	const start = Date.now()
	while (sink.messages.length < min) {
		if (Date.now() - start > timeoutMs) {
			throw new Error(`timed out waiting for ${min} sink message(s), got ${sink.messages.length}`)
		}
		await new Promise((r) => setTimeout(r, 50))
	}
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
