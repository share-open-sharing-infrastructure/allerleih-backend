// #607 review S1/S8: the other half of assetBase()'s fallback behaviour — see the doc comment in
// tests/unsubscribe-no-base.test.mjs for why this needs a SEPARATE file/process (FRONTEND_URL is
// read from process.env exactly once, at constants.js's first require(), so the "FRONTEND_URL IS
// available" and "FRONTEND_URL is NOT available" cases can't share one process) and why a fake
// `app` is used instead of a real PocketBase instance (its Settings model won't allow an empty
// `meta.appURL` through the API in the first place).
//
// #607 review S8 (the case added here, previously untested): a stock PocketBase instance that
// never had APP_URL set reports `settings().meta.appURL === 'http://localhost:8090'` — PocketBase's
// own built-in default — NOT an empty string, so the "falls back to FRONTEND_URL when appURL is
// empty" test above never actually exercised the real production bug (SMTP configured via the
// admin UI, APP_URL forgotten). The loopback-default tests below are the crux of that fix: the
// fallback to FRONTEND_URL must engage for a loopback appURL exactly like it does for an empty one.
//
// `APP_URL` (unlike `FRONTEND_URL`) is read fresh on every assetBase() call, not cached at
// require-time — so, unlike FRONTEND_URL, it CAN be toggled per-test within this one file/process;
// the one test that sets it restores it via try/finally so it never leaks into a later test.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const hooksDir = path.resolve(__dirname, '../pb_hooks')

process.env.FRONTEND_URL = 'https://fe.example.test'
delete process.env.APP_URL

globalThis.__hooks = hooksDir
globalThis.$os = { getenv: (name) => process.env[name] || '' }

const require = createRequire(import.meta.url)
const { assetBase } = require(path.join(hooksDir, 'utils/urls.js'))

function fakeApp(appURL) {
	return { settings: () => ({ meta: { appURL } }) }
}

test('assetBase(): falls back to FRONTEND_URL when settings().meta.appURL is empty', () => {
	assert.equal(assetBase(fakeApp('')), 'https://fe.example.test')
})

test('assetBase(): settings().meta.appURL still wins over FRONTEND_URL when both are set', () => {
	assert.equal(assetBase(fakeApp('https://backend.example.test')), 'https://backend.example.test')
})

test('assetBase(): trailing slashes are stripped from either source', () => {
	assert.equal(assetBase(fakeApp('https://backend.example.test/')), 'https://backend.example.test')
})

test('assetBase(): falls back to FRONTEND_URL when settings().meta.appURL is only the PocketBase loopback default ("http://localhost:8090") — #607 review S8, the real bug case', () => {
	assert.equal(assetBase(fakeApp('http://localhost:8090')), 'https://fe.example.test')
})

test('assetBase(): treats a 127.0.0.1 appURL the same as localhost (also loopback, also falls back)', () => {
	assert.equal(assetBase(fakeApp('http://127.0.0.1:8090')), 'https://fe.example.test')
})

test('assetBase(): an explicitly-set APP_URL wins even when it is a loopback address — the README\'s own local-SMTP-testing recipe sets APP_URL=http://127.0.0.1:8090 on purpose, so local dev must not break', () => {
	process.env.APP_URL = 'http://127.0.0.1:8090'
	try {
		assert.equal(assetBase(fakeApp('http://127.0.0.1:8090')), 'http://127.0.0.1:8090')
	} finally {
		delete process.env.APP_URL
	}
})
