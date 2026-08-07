/// <reference path="../pb_data/types.d.ts" />

/**
 * Auth-mail template host injection (#447) — bootstrap hook.
 *
 * The `users` auth-mail templates (verification / email-change / password-reset) link to SvelteKit
 * frontend pages. On every start this hook rewrites the host of those three links to the concrete
 * FRONTEND_URL so they point at the actual frontend origin for this instance — the same
 * reproducible, per-instance-from-env pattern as mail_config.pb.js.
 *
 * Ordering note: `onBootstrap` runs BEFORE the pb_migrations are applied, so on a *fresh* serve this
 * hook sees the pre-migration templates and is a no-op — the migration
 * (1784214716_auth_mail_templates_frontend_urls.js) is what makes the first serve correct (it
 * resolves the host to FRONTEND_URL itself). From the second start onward the templates already
 * carry the frontend paths, and THIS hook keeps the host in sync with FRONTEND_URL — so a changed
 * FRONTEND_URL is picked up on the next restart without needing a new migration.
 *
 * Deliberately narrow, mirroring the #447 decision:
 *   - FRONTEND_URL set   → rewrite the host of the three known frontend paths in the `users`
 *     templates to FRONTEND_URL. Idempotent: only save when a body actually changed.
 *   - FRONTEND_URL unset → no-op; whatever the migration wrote stays (the `{APP_URL}` baseline
 *     expands to settings.meta.appURL at send time).
 *   - `settings.meta.appURL` is NEVER touched, and the `_superusers` templates are NEVER touched —
 *     their `/_/#/...` admin-UI links must keep resolving against the backend admin UI.
 *
 * The `{TOKEN}` PocketBase placeholder is preserved. Logging never includes personal data.
 */
onBootstrap((e) => {
	// Let the rest of the bootstrap chain run first (loads settings, initializes resources). On a
	// restart the templates already carry the frontend paths, so the read below matches and the host
	// gets rewritten; on a fresh serve migrations haven't applied yet, so the read is a no-op (the
	// migration handles that case — see the header note). Collection ORM access uses `e.app` (the
	// bootstrapped app), like the record/transaction hooks — the global `$app` is not ready for
	// collection lookups this early and throws "sql: no rows in result set".
	e.next()

	const { FRONTEND_URL } = require(`${__hooks}/constants.js`)

	if (!FRONTEND_URL) {
		$app.logger().info('[auth-mail] FRONTEND_URL not set — leaving auth-mail template hosts untouched')
		return
	}

	const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

	// Rewrite the host segment that immediately precedes the known frontend `path` to FRONTEND_URL.
	// Returns the new body when it differs, otherwise null (idempotent no-op).
	const rewriteHost = (tpl, path) => {
		if (!tpl || !tpl.body) return null
		const re = new RegExp('href="[^"]*' + escapeRegex(path) + '"', 'g')
		const newBody = tpl.body.replace(re, 'href="' + FRONTEND_URL + path + '"')
		return newBody !== tpl.body ? newBody : null
	}

	try {
		const c = e.app.findCollectionByNameOrId('hbacudkt08pfcy3') // users
		let changed = false

		// Assign each template via dot-notation with the whole { subject, body } object — the same
		// pattern the migration uses. Mutating a nested `.body` on the Go-backed struct does not
		// persist.
		const vBody = rewriteHost(c.verificationTemplate, '/auth/confirm-verification?token={TOKEN}')
		if (vBody !== null) {
			c.verificationTemplate = { subject: c.verificationTemplate.subject, body: vBody }
			changed = true
		}

		const eBody = rewriteHost(c.confirmEmailChangeTemplate, '/auth/confirm-email-change?token={TOKEN}')
		if (eBody !== null) {
			c.confirmEmailChangeTemplate = { subject: c.confirmEmailChangeTemplate.subject, body: eBody }
			changed = true
		}

		const rBody = rewriteHost(c.resetPasswordTemplate, '/auth/reset/confirm?token={TOKEN}')
		if (rBody !== null) {
			c.resetPasswordTemplate = { subject: c.resetPasswordTemplate.subject, body: rBody }
			changed = true
		}

		if (!changed) {
			$app.logger().info('[auth-mail] auth-mail template hosts already match FRONTEND_URL — no change')
			return
		}

		e.app.save(c)
		$app.logger().info('[auth-mail] auth-mail template hosts set to FRONTEND_URL')
	} catch (err) {
		// A failure here must not take the whole API down (a mail typo shouldn't be fatal), but it
		// must be unmissable: the confirmation links would otherwise keep the previous host.
		$app.logger().error(
			'[auth-mail] FAILED to inject FRONTEND_URL into auth-mail templates — confirmation links may be wrong',
			'error', err.toString()
		)
	}
})
