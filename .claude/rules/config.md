---
paths:
  - "pb_hooks/constants.js"
  - "pb_hooks/mail_config.pb.js"
---

# Configuration (`pb_hooks/constants.js`)

All env/config is centralized here; most have safe defaults:

| Export | Env var | Default | Purpose |
|---|---|---|---|
| `LOG_LEVEL` | `LOG_LEVEL` | `4` | 1=DEBUG … 4=ERROR |
| `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` / `VAPID_SUBJECT` | `VAPID_*` | — / `mailto:allerleih@posteo.de` | Web-push |
| `DRY_MODE` | `DRY_MODE` | `false` | When `true`, skips sending email/notifications (local dev) |
| `MAIL_THROTTLE_MINUTES` | `MAIL_THROTTLE_MINUTES` | `15` | Max one notification email per user per N minutes |
| `FRONTEND_URL` | `FRONTEND_URL` | `''` | SvelteKit frontend origin (no trailing slash) — host for the `users` auth-mail links (#447) and the `APP_URL` fallback. **#487 Phase 3: no longer used by the integrations** (they run locally; `SYNC_SECRET` is gone) |
| `SYNC_CRON` | `SYNC_CRON` | `''` | Cron expression for the full catalogue pull — runs LOCALLY (`integrations/sync.js`); no HTTP, only a valid expression. Empty disables the job |
| `REFRESH_CRON` | `REFRESH_CRON` | `''` | Cron expression for the per-item refresh — runs LOCALLY (`integrations/refresh.js`); no HTTP, only a valid expression. Empty disables the job |
| `INTEGRATION_ALLOW_INSECURE_URL` | `INTEGRATION_ALLOW_INSECURE_URL` | `false` | Refresh only: allow `http://` + private/loopback source base URLs, bypassing the `integrations/urlGuard.js` SSRF check. **Local dev / integration tests only — never in production** (backend replacement for the frontend's Vite `dev` flag) |
| `RETENTION_INACTIVE_MONTHS` | `RETENTION_INACTIVE_MONTHS` | `6` | Anonymize accounts with no login for N months (0 = off) |
| `RETENTION_MESSAGES_MONTHS` | `RETENTION_MESSAGES_MONTHS` | `6` | Delete conversations N months after last activity (0 = off) |
| `RETENTION_NOTIFICATIONS_DAYS` | `RETENTION_NOTIFICATIONS_DAYS` | `90` | Delete in-app notifications after N days (0 = off) |
| `RETENTION_FEEDBACK_MONTHS` | `RETENTION_FEEDBACK_MONTHS` | `6` | Delete feedback entries after N months (0 = off) |
| `RETENTION_INACTIVE_WARN_DAYS` | `RETENTION_INACTIVE_WARN_DAYS` | `30` | Email the "account will be deleted on <date>" warning N days before the inactivity threshold, once per inactivity cycle (0 = off; must be smaller than the inactive window) |
| `ADMIN_NOTIFY_EMAIL` | `ADMIN_NOTIFY_EMAIL` | — | Admin recipient for the "inactive account skipped (open loan)" notice |
| `RETENTION_SKIP_NOTICE_COOLDOWN_DAYS` | `RETENTION_SKIP_NOTICE_COOLDOWN_DAYS` | `7` | Min days between repeat skip notices for the same account |
| `RETENTION_PAGE_SIZE` | `RETENTION_PAGE_SIZE` | `200` | Records per keyset-paginated batch in the retention jobs (tests set it low) |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_USERNAME` / `SMTP_PASSWORD` | `SMTP_*` | — / `587` / — / — | SMTP server applied on bootstrap by `mail_config.pb.js` **only when `SMTP_HOST` is set** (idempotent). Empty `SMTP_HOST` = no-op: existing admin-UI settings are left untouched (never disabled/cleared) |
| `SMTP_TLS` / `SMTP_AUTH_METHOD` / `SMTP_LOCAL_NAME` | `SMTP_*` | `false` / `PLAIN` / — | `SMTP_TLS=true` = implicit TLS (465); `false` = STARTTLS (587) |
| `SENDER_ADDRESS` / `SENDER_NAME` | same | — | Optional overrides of the `meta` mail settings; only applied when set |
| `APP_URL` | `APP_URL` | `FRONTEND_URL` | Documented fallback host for the `{APP_URL}` placeholder in the `users` auth-mail templates (#447); defaults to `FRONTEND_URL`. **`mail_config.pb.js` only writes `settings.meta.appURL` from an *explicitly-set* `APP_URL` env**, never from this fallback — otherwise the `_superusers` admin-UI links would break. #607: this is also the **backend** origin returned by `utils/urls.js` → `assetBase()` (pb_public assets, `/api/files/…`, the unsubscribe endpoint) — `siteBase()` (the **frontend** origin, `FRONTEND_URL`) is the one to use for any user-facing app link. Mixing the two up 404s the link on the wrong host (#607 finding B1). **`assetBase()`'s resolution order (#607 review S8, replacing the earlier S1 fallback)**: (1) an *explicitly-set* `APP_URL` env, read raw — honored even if it is a loopback value (the README's local-SMTP-testing recipe deliberately sets `APP_URL=http://127.0.0.1:8090`); (2) `settings.meta.appURL`, **unless it is a loopback host** (`localhost`/`127.0.0.0/8`/`[::1]`) — empirically, a stock instance that never had `APP_URL` set reports `settings.meta.appURL === 'http://localhost:8090'` (PocketBase's own built-in default, never actually blank), so the old `\|\| FRONTEND_URL` fallback never fired for exactly the deployment that needs it (SMTP configured via the admin UI, `APP_URL` forgotten); (3) `FRONTEND_URL`; (4) `''` if none apply. When the result is `''`, `services/unsubscribe.js` → `unsubscribeUrl()` logs an error (never the token/userId) and returns `''` rather than handing back a relative, RFC-8058-invalid `List-Unsubscribe` URI |
| `DIGEST_SENDER_ADDRESS` / `DIGEST_SENDER_NAME` | `DIGEST_SENDER_*` | — | #607: optional own sender identity for the weekly digest (`kind: 'bulk'` sends). Empty (default) = identical to today's transactional sender. `DIGEST_SENDER_NAME` alone does **not** switch the address (see `services/mail.js` → `senderFor()`). **Do not set in production before SPF/DKIM/DMARC are configured for that address** — see the frontend `docs/operations/mail-deliverability.md` runbook |
| `UNSUBSCRIBE_SECRET` | `UNSUBSCRIBE_SECRET` | — (derived) | #607: HMAC secret signing the stateless one-click digest-unsubscribe tokens (`services/unsubscribe.js`). Empty → derived from the `users` collection's `authToken.secret` (logged as unavailable, never the value). Set an explicit secret in production so rotating the auth-token secret doesn't invalidate every unsubscribe link already sent |
| `DIGEST_PACING_MS` / `DIGEST_BATCH_SIZE` / `DIGEST_BATCH_PAUSE_MS` | same | `200` / `50` / `5000` | #607: anti-burst pacing for the weekly digest — `sleep()` between sends, plus a longer pause every `DIGEST_BATCH_SIZE` sends. `0` disables the corresponding pause. A courtesy to the receiving mail server, not a rate limit; see `jobs/digest.js` |

Also expected at runtime: `ORS_API_KEY` (travel-times). Locally these are dummy values, so push,
geocoding, and email don't work for real.
