/// <reference path="../pb_data/types.d.ts" />

// #447 — point the `users` auth-mail confirmation links at the SvelteKit frontend pages instead of
// the PocketBase admin UI (`/_/#/...`) or the hard-coded `https://allerleih.org` origin from #367.
//
// The three affected templates are the German `users`-collection templates:
//   - verificationTemplate      → {APP_URL}/auth/confirm-verification?token={TOKEN}
//   - confirmEmailChangeTemplate→ {APP_URL}/auth/confirm-email-change?token={TOKEN}
//   - resetPasswordTemplate     → {APP_URL}/auth/reset/confirm?token={TOKEN}
//
// The host is left as the `{APP_URL}` PocketBase placeholder (the documented, per-instance fallback).
// On every start the `auth_mail_templates.pb.js` bootstrap hook rewrites that host to the concrete
// `FRONTEND_URL` when it is set; when it is not, `{APP_URL}` expands to `settings.meta.appURL` at
// send time. Only the German (`users`) templates change here — the `_superusers` templates keep
// their `/_/#/...` admin-UI links and are NOT touched (see #447 decision + CLAUDE.md).
//
// Only the `href` inside the `<a class="btn">` changes; the German copy and subjects are preserved.

const USERS_ID = 'hbacudkt08pfcy3'

// Host for the confirmation links. `onBootstrap` hooks (incl. auth_mail_templates.pb.js) run BEFORE
// pb_migrations are applied, so a hook cannot fix up this migration's output on the very first serve
// — that would leave the links on the unresolved `{APP_URL}` baseline until a second restart. To
// guarantee correctness from the first start, the migration itself resolves the host to the concrete
// FRONTEND_URL when it is set, and falls back to the `{APP_URL}` placeholder (→ settings.meta.appURL
// at send time) otherwise. On every subsequent start the auth_mail_templates.pb.js hook re-applies
// FRONTEND_URL, so a later FRONTEND_URL change is picked up without needing a new migration.
const HOST = ($os.getenv('FRONTEND_URL') || '').replace(/\/+$/, '') || '{APP_URL}'

// --- NEW (up) bodies: only the button href is changed to a frontend path ---
const UP = {
	verification: {
		subject: 'Verifiziere deine {APP_NAME} email',
		body: '<p>Hi,</p>\n<p>Schön, dich auf {APP_NAME} begrüßen zu dürfen!</p>\n<p>Klick auf die "Verifizieren"-Schaltfläche unten, um dein Konto zu verifizieren.</p>\n<p>\n  <a class="btn" href="' + HOST + '/auth/confirm-verification?token={TOKEN}" target="_blank" rel="noopener">Verifizieren</a>\n</p>\n<p>\n  Happy Sharing!<br/>\n  Timo & Matteo von {APP_NAME}\n</p>',
	},
	emailChange: {
		subject: 'Bestätige deine neue {APP_NAME} email',
		body: '<p>Hi,</p>\n<p>Klick auf die Schaltfläche unten, um die Änderung deiner Mail bei {APP_NAME} zu bestätigen.</p>\n<p>\n  <a class="btn" href="' + HOST + '/auth/confirm-email-change?token={TOKEN}" target="_blank" rel="noopener">Neue E-Mail bestätigen</a>\n</p>\n<p><i>Falls du keine Änderung der Mail angestoßen hast, kannst du diese Nachricht ignorieren.</i></p>\n<p>\n  Happy Sharing!<br/>\n  Dein {APP_NAME} Team\n</p>',
	},
	reset: {
		subject: 'Setze dein {APP_NAME} Passwort zurück!',
		body: '<p>Hi, </p>\n<p>Klick auf die Schaltfläche, um dein Passwort zurückzusetzen.</p>\n<p>\n  <a class="btn" href="' + HOST + '/auth/reset/confirm?token={TOKEN}" target="_blank" rel="noopener">Passwort zurücksetzen</a>\n</p>\n\n<p>\n  Liebe Grüße,<br/>\n  Timo & Matteo von {APP_NAME}\n</p>',
	},
}

// --- OLD (down) bodies: the exact values from 1781551136_collections_snapshot.js ---
const DOWN = {
	verification: {
		subject: 'Verifiziere deine {APP_NAME} email',
		body: '<p>Hi,</p>\n<p>Schön, dich auf {APP_NAME} begrüßen zu dürfen!</p>\n<p>Klick auf die "Verifizieren"-Schaltfläche unten, um dein Konto zu verifizieren.</p>\n<p>\n  <a class="btn" href="{APP_URL}/_/#/auth/confirm-verification/{TOKEN}" target="_blank" rel="noopener">Verifizieren</a>\n</p>\n<p>\n  Happy Sharing!<br/>\n  Timo & Matteo von {APP_NAME}\n</p>',
	},
	emailChange: {
		subject: 'Bestätige deine neue {APP_NAME} email',
		body: '<p>Hi,</p>\n<p>Klick auf die Schaltfläche unten, um die Änderung deiner Mail bei {APP_NAME} zu bestätigen.</p>\n<p>\n  <a class="btn" href="{APP_URL}/_/#/auth/confirm-email-change/{TOKEN}" target="_blank" rel="noopener">Neue E-Mail bestätigen</a>\n</p>\n<p><i>Falls du keine Änderung der Mail angestoßen hast, kannst du diese Nachricht ignorieren.</i></p>\n<p>\n  Happy Sharing!<br/>\n  Dein {APP_NAME} Team\n</p>',
	},
	reset: {
		subject: 'Setze dein {APP_NAME} Passwort zurück!',
		body: '<p>Hi, </p>\n<p>Klick auf die Schaltfläche, um dein Passwort zurückzusetzen.</p>\n<p>\n  <a class="btn" href="https://allerleih.org/auth/reset/confirm?token={TOKEN}" target="_blank" rel="noopener">Passwort zurücksetzen</a>\n</p>\n\n<p>\n  Liebe Grüße,<br/>\n  Timo & Matteo von {APP_NAME}\n</p>',
	},
}

function applyTemplates(app, t) {
	const c = app.findCollectionByNameOrId(USERS_ID)
	// Reassign the whole template object — mutating a nested `.body` on the Go-backed struct getter
	// does not persist, so we set the full { subject, body } each time.
	c.verificationTemplate = { subject: t.verification.subject, body: t.verification.body }
	c.confirmEmailChangeTemplate = { subject: t.emailChange.subject, body: t.emailChange.body }
	c.resetPasswordTemplate = { subject: t.reset.subject, body: t.reset.body }
	return app.save(c)
}

migrate(
	(app) => applyTemplates(app, UP),
	(app) => applyTemplates(app, DOWN)
)
