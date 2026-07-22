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
| `FRONTEND_URL` | `FRONTEND_URL` | `''` | SvelteKit frontend origin (no trailing slash) — target of the sync/refresh cron calls. **Must be `https://` unless loopback** — the sync secret travels as a Bearer header (non-loopback `http://` logs a startup warning) |
| `SYNC_SECRET` | `SYNC_SECRET` | `''` | Bearer token for the frontend's `/api/sync` + `/api/refresh`; must equal the frontend's `SYNC_SECRET` |
| `SYNC_CRON` | `SYNC_CRON` | `''` | Cron expression for the full catalogue pull (`POST /api/sync`); empty disables the job |
| `REFRESH_CRON` | `REFRESH_CRON` | `''` | Cron expression for the per-item refresh (`POST /api/refresh`); empty disables the job |
| `SYNC_TIMEOUT_SECONDS` | `SYNC_TIMEOUT_SECONDS` | `540` | HTTP timeout for the sync/refresh calls (a full sync can take minutes) |
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
| `APP_URL` | `APP_URL` | `FRONTEND_URL` | Documented fallback host for the `{APP_URL}` placeholder in the `users` auth-mail templates (#447); defaults to `FRONTEND_URL`. **`mail_config.pb.js` only writes `settings.meta.appURL` from an *explicitly-set* `APP_URL` env**, never from this fallback — otherwise the `_superusers` admin-UI links would break |

Also expected at runtime: `ORS_API_KEY` (travel-times). Locally these are dummy values, so push,
geocoding, and email don't work for real.
