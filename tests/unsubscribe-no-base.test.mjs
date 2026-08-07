// #607 review S1/S8: with NEITHER an explicit `APP_URL`, NOR a usable `settings().meta.appURL`,
// NOR `FRONTEND_URL` available, assetBase() has no absolute origin to fall back to at all, and
// unsubscribeUrl() must degrade gracefully — log (never the token/userId!) and return '' — rather
// than a relative "/api/unsubscribe/..." path, which would be an invalid List-Unsubscribe URI per
// RFC 8058 and useless in an email body.
//
// This is a PURE unit test against a fake `app`, not a real PocketBase instance: empirically,
// PocketBase's Settings model enforces `meta.appURL` as a REQUIRED, non-blank field (confirmed by
// hand: PATCH /api/settings with an empty appURL 400s with "Cannot be blank", and PocketBase ships
// a non-empty built-in default — "http://localhost:8090" — that `mail_config.pb.js` never touches
// when APP_URL is unset), so a real running instance can never actually reach a literally-empty
// appURL through any supported path. The two cases below exercise BOTH shapes assetBase() must
// treat as "unusable": the pure-empty-string edge case (`fakeApp('')`) AND — #607 review S8, the
// actually-occurring production bug, previously untested — PocketBase's own built-in loopback
// default (`fakeApp('http://localhost:8090')`); this file's fixed env (FRONTEND_URL unset) makes
// both resolve to `assetBase() === ''`, since there is nothing left to fall back to. Testing this
// has to go through a fake `app`, exactly like tests/digest-internals.test.mjs does for
// jobs/digest.js and for the same underlying reason: urls.js/unsubscribe.js are plain CommonJS
// modules (not `*.pb.js` hook files), so they require() fine from plain Node once `__hooks` and the
// couple of PocketBase-runtime globals they touch ($os.getenv, $security.hs256/.equal) are stubbed.
//
// IMPORTANT: constants.js reads FRONTEND_URL/UNSUBSCRIBE_SECRET from process.env exactly ONCE, at
// its first require() (module caching) — so both must be set BEFORE the first call into
// urls.js/unsubscribe.js, and can't be toggled per-test within this one process/file. FRONTEND_URL
// is deliberately left unset here to reach the fully-unusable case; see
// urls-assetbase-fallback.test.mjs for the "FRONTEND_URL IS available" half of assetBase()'s
// fallback behaviour — including the loopback-default variant of THAT half, where the fallback
// must actually engage instead of handing back the unreachable loopback value (the crux of #607
// review S8: the old code never reached that fallback for a non-empty loopback appURL).
//
// APP_URL, unlike FRONTEND_URL, is read fresh on every assetBase() call (not cached at
// require-time), but is still explicitly deleted below for determinism — a stray APP_URL in the
// runner's own shell environment must never leak into this "nothing is configured" scenario.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'
import crypto from 'node:crypto'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const hooksDir = path.resolve(__dirname, '../pb_hooks')

delete process.env.FRONTEND_URL
delete process.env.APP_URL
process.env.UNSUBSCRIBE_SECRET = 'test-only-unsubscribe-secret-do-not-use-in-prod'

globalThis.__hooks = hooksDir
globalThis.$os = { getenv: (name) => process.env[name] || '' }
globalThis.$security = {
	hs256: (text, secret) => crypto.createHmac('sha256', secret).update(text).digest('hex'),
	equal: (a, b) => a === b,
}

const require = createRequire(import.meta.url)
const { assetBase } = require(path.join(hooksDir, 'utils/urls.js'))
const { unsubscribeUrl } = require(path.join(hooksDir, 'services/unsubscribe.js'))

/** Fake PocketBase `app` — just enough for assetBase()/unsubscribeUrl(): settings() + logger(). */
function fakeApp(appURL) {
	const errors = []
	return {
		settings: () => ({ meta: { appURL } }),
		logger: () => ({ error: (...args) => errors.push(args), info() {}, warn() {}, debug() {} }),
		errors,
	}
}

test('assetBase(): returns "" when neither settings().meta.appURL nor FRONTEND_URL is available', () => {
	assert.equal(assetBase(fakeApp('')), '')
})

test('assetBase(): returns "" when settings().meta.appURL is only the PocketBase loopback default and neither APP_URL nor FRONTEND_URL is set — the real #607 review S8 bug case', () => {
	assert.equal(assetBase(fakeApp('http://localhost:8090')), '')
})

test('unsubscribeUrl(): returns "" and logs an error — never the token/userId — when no absolute base is available', () => {
	const app = fakeApp('')

	const url = unsubscribeUrl(app, 'user123', 'digest')

	assert.equal(url, '', 'no relative link must ever be handed back')
	assert.equal(app.errors.length, 1, 'the degradation must be logged, not silent')
	const logged = app.errors[0].join(' ')
	assert.ok(!logged.includes('user123'), 'must never log the userId')
	assert.ok(!/\.[0-9a-f]{16,}/.test(logged), 'must never log a token/signature')
})
