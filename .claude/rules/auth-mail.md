---
paths:
  - "pb_hooks/auth_mail_templates.pb.js"
  - "pb_hooks/mail_config.pb.js"
---

# Auth-mail templates (#447)

Each auth collection has its own email templates (`verificationTemplate`, `confirmEmailChangeTemplate`,
`resetPasswordTemplate`). They are configured **per collection**:

- **`users`** (the German, member-facing templates) link to the **SvelteKit frontend** confirmation
  pages: `/auth/confirm-verification?token={TOKEN}`, `/auth/confirm-email-change?token={TOKEN}`,
  `/auth/reset/confirm?token={TOKEN}`. The host is the concrete `FRONTEND_URL`, with the `{APP_URL}`
  placeholder as a documented fallback when `FRONTEND_URL` is unset.
- **`_superusers`** (the admin templates) keep their PocketBase admin-UI links (`{APP_URL}/_/#/...`)
  and are **never touched** — they must resolve against the backend admin UI.

Two cooperating pieces keep the `users` host correct, because **`onBootstrap` hooks run *before*
`pb_migrations` are applied** (an `onBootstrap` handler cannot see, or fix up, this migration's output
on a fresh serve):

1. `pb_migrations/<ts>_auth_mail_templates_frontend_urls.js` writes the three template bodies with the
   frontend paths and resolves the host to `FRONTEND_URL` (falling back to `{APP_URL}`) — this makes
   the **first** serve correct. Its `down` restores the pre-#447 snapshot values.
2. `pb_hooks/auth_mail_templates.pb.js` (`onBootstrap`) re-injects `FRONTEND_URL` as the host on
   **every subsequent** start, so a changed `FRONTEND_URL` is picked up on restart without a new
   migration. Idempotent (saves only on change); a no-op when `FRONTEND_URL` is unset; never touches
   `settings.meta.appURL` or the `_superusers` templates.
