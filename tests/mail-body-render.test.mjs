// Regression coverage for renderMailBody() (pb_hooks/services/mail.js) — the structural fix for
// the reported "href="/conversations"" bug: buildMessage()/sendNotificationEmail() only ever
// inject SITE_URL/ASSET_URL into views/layout.html, and the body is spliced into it via
// `{{raw .CONTENT}}`, which does NOT re-resolve placeholders in already-rendered HTML. So a body
// template that itself uses {{.SITE_URL}} (new_message.html, retention_skipped_user.html, ...)
// silently got nothing unless its own render() call supplied the base — two call sites forgot.
//
// No PocketBase instance needed for the first three tests: renderMailBody()'s only
// PocketBase-runtime dependency is `$template` (stubbed below to just echo the merged render()
// data back as JSON, so the MERGE logic — bases resolved by default, an explicit `bases` used
// as-is, and `bases` always winning over `data` (never the reverse — see that test's own comment
// for why) — is directly assertable without the real Go html/template engine) plus
// `siteBase()`/`assetBase()`, real pure functions from utils/urls.js (already covered by
// tests/urls-assetbase-fallback.test.mjs) called through a call-counting fake `app`. Same
// require()-a-real-hooks-module-with-stubbed-globals pattern as tests/digest-internals.test.mjs.
//
// The fourth test is a plain static source scan (no PocketBase, no stubs) — a guard against the
// bug CLASS: no file besides services/mail.js may reference both `loadFiles` and a `views/mail`
// path, which is what any call site rendering a mail body directly (bypassing renderMailBody()
// and its always-injected bases) would do. See that test's own comment for exactly what it does
// and does not catch.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const hooksDir = path.resolve(__dirname, '../pb_hooks')

globalThis.__hooks = hooksDir
globalThis.$os = { getenv: (name) => process.env[name] || '' }
globalThis.$template = {
	// Real $template.render() produces HTML; this fake just echoes the merged data map back as
	// JSON so the test can assert on exactly what renderMailBody() would have handed to it.
	loadFiles: () => ({ render: (data) => JSON.stringify(data) }),
}

const require = createRequire(import.meta.url)
const { renderMailBody } = require(path.join(hooksDir, 'services/mail.js'))

/** Fake $app. `throwOnSettings` proves a code path never calls app.settings() (via siteBase()/assetBase()). */
function fakeApp(throwOnSettings) {
	return {
		settings: () => {
			if (throwOnSettings) throw new Error('app.settings() must not be called when bases are pre-resolved')
			return { meta: { appURL: 'http://localhost:8090', senderAddress: 'a@b.test', senderName: 'A' } }
		},
	}
}

test('renderMailBody(): without explicit bases, resolves SITE_URL/ASSET_URL via siteBase()/assetBase()', () => {
	delete process.env.FRONTEND_URL
	delete process.env.APP_URL

	const rendered = JSON.parse(renderMailBody(fakeApp(false), 'new_message', { RECIPIENT_NAME: 'Alice' }))

	// No FRONTEND_URL/APP_URL configured -> both fall back to settings().meta.appURL.
	assert.equal(rendered.SITE_URL, 'http://localhost:8090')
	assert.equal(rendered.RECIPIENT_NAME, 'Alice', 'template-specific data must pass through unchanged')
})

test('renderMailBody(): an explicit `bases` argument is used as-is and never calls app.settings()', () => {
	const bases = { SITE_URL: 'https://fe.example.test', ASSET_URL: 'https://backend.example.test' }

	// fakeApp(true) throws from settings() — if renderMailBody() ignored `bases` and resolved the
	// URLs itself anyway (siteBase()/assetBase() both read app.settings()), this test would throw.
	const rendered = JSON.parse(renderMailBody(fakeApp(true), 'weekly_digest', { RECIPIENT_NAME: 'Bob' }, bases))

	assert.equal(rendered.SITE_URL, bases.SITE_URL)
	assert.equal(rendered.ASSET_URL, bases.ASSET_URL)
	assert.equal(rendered.RECIPIENT_NAME, 'Bob')
})

test('renderMailBody(): `data` can NOT override SITE_URL/ASSET_URL — the bases always win (spread last)', () => {
	// Deliberate: if `data` won, a call site that assembles it from a larger source carrying its
	// own SITE_URL/ASSET_URL field would silently shadow the real origin — the same bug class this
	// helper exists to close, just via a different door. The explicit `bases` argument (tested
	// above) is the ONLY sanctioned override.
	const bases = { SITE_URL: 'https://fe.example.test', ASSET_URL: 'https://backend.example.test' }
	const rendered = JSON.parse(
		renderMailBody(
			fakeApp(true),
			'weekly_digest',
			{ SITE_URL: 'https://attacker.example.test', ASSET_URL: 'https://attacker.example.test', RECIPIENT_NAME: 'Bob' },
			bases
		)
	)

	assert.equal(rendered.SITE_URL, bases.SITE_URL, 'a data.SITE_URL must be ignored')
	assert.equal(rendered.ASSET_URL, bases.ASSET_URL, 'a data.ASSET_URL must be ignored')
	assert.equal(rendered.RECIPIENT_NAME, 'Bob', 'non-base fields in data still pass through unchanged')
})

test('no file besides services/mail.js references BOTH $template.loadFiles and a views/mail path', () => {
	// Two INDEPENDENT substring checks rather than one adjacency regex on the exact call-site
	// syntax: a regex tied to the literal `$template.loadFiles(\`${__hooks}/views/mail/...\`)` text
	// would go green again the moment a future call site stores the path in a variable, builds it
	// via concatenation, or otherwise reshapes the same call — none of which changes the file's
	// intent, only its syntax. Requiring the two tokens to merely co-occur anywhere in the file
	// survives all of those harmless rewrites; it would only be fooled by deliberately obfuscating
	// one of the two literal strings (e.g. splitting 'load' + 'Files'), which is not a realistic
	// accident. Verified to fail against the pre-fix code (notification.pb.js + jobs/retention.js
	// both called $template.loadFiles directly on a views/mail/*.html path).
	const offenders = []

	function walk(dir) {
		for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
			const full = path.join(dir, entry.name)
			if (entry.isDirectory()) {
				walk(full)
				continue
			}
			// services/mail.js is renderMailBody()'s own implementation — it's exactly the one
			// permitted place this pattern may appear.
			if (!entry.name.endsWith('.js') || full === path.join(hooksDir, 'services', 'mail.js')) continue

			const src = fs.readFileSync(full, 'utf8')
			if (src.includes('loadFiles') && src.includes('views/mail')) offenders.push(path.relative(hooksDir, full))
		}
	}
	walk(hooksDir)

	assert.deepEqual(
		offenders,
		[],
		`these files reference both loadFiles and views/mail — they likely render a views/mail/*.html body directly instead of via renderMailBody(), so it may not get SITE_URL/ASSET_URL: ${offenders.join(', ')}`
	)
})
