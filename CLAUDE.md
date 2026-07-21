# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project overview

**AllerLeih backend** — the PocketBase server for the AllerLeih item-sharing platform.
PocketBase runs as a single binary ("Zero-Go"): all custom server logic lives in **JS hooks**
(`pb_hooks/`) and all schema lives in **versioned migrations** (`pb_migrations/`) that auto-apply
on start. There is no separate application server and no build step. The companion SvelteKit
frontend lives in the `share-mvp` repo (`~/allerleih`) and talks to this backend over the
PocketBase REST/realtime API.

## Running and testing

```bash
./pocketbase serve --http=0.0.0.0:8090   # start; applies pending migrations, loads pb_hooks
                                         # API on :8090, admin UI on :8090/_/
./pocketbase superuser upsert <email> <password>   # create an admin
npm test                                 # node --test, runs tests/*.test.mjs serially
```

- **Migrations auto-apply on every `serve`**, in filename order. `pb_data/` is the live SQLite
  DB + uploads (not in the repo); delete it to reset to a clean migrated state.
- **Tests** spin up a *throwaway* PocketBase on a separate port against a throwaway data dir,
  apply all migrations + hooks, and run end-to-end via HTTP. Helpers in `tests/harness.mjs`
  (`startPB`, `stopPB`, `api`, `makeUser`, `adminAuth`). They run serially
  (`--test-concurrency=1`) because each owns the server.

## Repository structure

```
pb_hooks/                    # custom server logic (auto-loaded JS)
├── main.pb.js               # bootstrap / startup logging
├── mail_config.pb.js        # bootstrap: configures SMTP from env when SMTP_HOST is set (#8); unset = no-op
├── auth_mail_templates.pb.js # bootstrap: re-injects FRONTEND_URL as the host of the three `users`
│                            #   auth-mail links every start (#447); no-op when FRONTEND_URL unset
├── constants.js             # ALL env vars + config in one place (see below)
├── group.pb.js              # group lifecycle hooks + /api/group-invite/* routes
├── trust.pb.js              # `trusts` join guard (rejects self-trust edges)
├── invite.pb.js             # GET /api/invite/{code} — public invite-code lookup
├── contact.pb.js            # GET /api/contact/{userId} — visibility-gated contact handles
├── travel.pb.js             # POST /api/travel-times — ORS travel-time matrix
├── legal.pb.js              # platform legal consent (#399): /api/legal/accept|decline (superuser,
│                            #   server-authoritative), users-create consent stamping, locked-user guard
├── notification.pb.js       # messages → in-app notification + throttled email
├── notification_guard.pb.js # onRecordCreateRequest guard: a user-created notification must be
│                            #   authored by the caller and match a real event (conversation
│                            #   participants / existing trust edge); superuser/$app creates skip it
├── lending.pb.js            # #373 conversations onRecordUpdateRequest guard: only a participant may
│                            #   abort (lendingStatus → 'aborted') from pending/accepted; on accepted →
│                            #   aborted resets the requested item to 'available' atomically (elevated tx)
├── integration_sync.pb.js   # cron registration: integration_sync + integration_refresh — as of #487
│                            #   Phase 2 BOTH run LOCALLY via integrations/{sync,refresh}.js (see below)
├── integrations/            # #487 backend integration port (Goja, ES5-ish): sync.js (runSync() full
│                            #   pull + archive-guard), refresh.js (runRefresh() per-item + circuit-
│                            #   breaker + ordered registry [winbiap, leihbackend]), db.js (findSyncConfigs
│                            #   + applyDiff), diff.js, leihbackend.js (mapItem + fetchAllItems), winbiap.js,
│                            #   urlGuard.js, types.js, import.js (CSV apply/preview/refresh, Phase 3)
├── services/                # shared business logic: group.js, notification.js, mail.js, syncConfig.js
│                            #   (backfillSyncConfigs — users.leihbackendUrl → sync_config, #487 Phase 2)
├── integration_import.pb.js # #487 Phase 3: CSV-import write path — POST /api/import/{apply,preview,
│                            #   refresh} (requireAuth, institution-only, owner = e.auth.id)
├── utils/                   # common.js (nowIso, formatDateTime, uniqueBy), db.js
├── views/                   # email HTML templates (layout.html + mail/)
├── jobs/                    # cron job bodies: retention.js  (integrationSync.js removed in #487 Phase 3)
├── routes/                  # placeholder — routes currently live in *.pb.js
├── account.pb.js            # DELETE /api/account + export, deleted-login block, lastLoginAt stamp,
│                            #   users email normalization (trim+lowercase) on create/update (#557)
├── retention.pb.js          # GDPR retention cron jobs (#461) + guarded test route
├── services/                # shared business logic: account.js, group.js, legal.js, notification.js, mail.js
├── utils/                   # common.js (now, monthsAgoIso, daysAgoIso, formatDateTime, uniqueBy),
│                            #   email.js (normalizeEmail + planEmailNormalization, #557), db.js
├── views/                   # email HTML templates (layout.html + mail/)
├── jobs/                    # retention.js — GDPR purge job logic (called from retention.pb.js)
├── routes/                  # placeholder — routes live in *.pb.js
pb_migrations/               # <timestamp>_<description>.js — schema, applied in filename order
pb_public/                   # static assets served by PocketBase
tests/                       # *.test.mjs integration tests + harness.mjs
pb_data/                     # live DB + uploads (gitignored, created on first serve)
```

## CRITICAL: hook files run in isolated contexts — `require()` inside the handler

Each `pb_hooks/*.pb.js` handler runs in its own isolated JS context. **Top-level imports are
NOT visible inside `routerAdd`/`onRecord*` callbacks.** You must `require()` shared code *inside*
the handler, using the `__hooks` magic path:

```javascript
// CORRECT — require inside the handler
onRecordAfterCreateSuccess((e) => {
  const { createNotification } = require(`${__hooks}/services/notification.js`)
  const { DRY_MODE } = require(`${__hooks}/constants.js`)
  // ...
  e.next()
}, 'messages')

// WRONG — top-level require is not in scope when the handler fires
const { createNotification } = require(`${__hooks}/services/notification.js`)  // ❌
```

Shared logic goes in `services/` (business logic) or `utils/` (pure helpers) and is exported with
`module.exports = { ... }`.

## Hook conventions

Register hooks at the top level of a `*.pb.js` file; group related hooks in the same file by
domain area (all group logic in `group.pb.js`, etc.).

```javascript
// Record lifecycle — second arg is the collection name
onRecordCreate((e) => { /* mutate e.record before save */ e.next() }, 'group_members')
onRecordAfterCreateSuccess((e) => { /* side effects after save */ e.next() }, 'groups')
onRecordDelete((e) => { /* runs before the delete commits */ e.next() }, 'groups')

// Custom HTTP route; append $apis.requireAuth() to require authentication
routerAdd('GET', '/api/invite/{code}', (e) => {
  const code = e.request.pathValue('code')
  return e.json(200, { /* ... */ })
})
routerAdd('POST', '/api/group-invite/{token}/join', (e) => { /* ... */ }, $apis.requireAuth())
```

Key globals available in hook context: `$app` (find/save/delete records, `settings()`, logger,
`runInTransaction`), `$apis` (`requireAuth()`), `$os` (`getenv`), `$http`, `$template`, and the
constructors `Record(collection)`, `Collection({...})`, `Field({...})`.

- **Saving via `$app.save()` runs in an elevated context and bypasses collection API rules** — so
  hooks can create records (e.g. auto-adding a group owner as an admin member) that the requesting
  user could not create directly. Be deliberate about this.
- **Use `$app.runInTransaction(txApp => {...})` for multi-step mutations** that must be atomic and
  race-free (re-check invariants like `maxUses` *inside* the transaction to avoid TOCTOU). See
  `group.pb.js` (the invite-join endpoint) for the canonical example.
- **Filter queries with placeholders**, never string interpolation:
  `$app.findFirstRecordByFilter('group_invites', 'token = {:t}', { t: token })`.

## Migration conventions

Filename: `<timestamp>_<snake_case_description>.js`. The timestamp prefix only controls **apply
order** — it must be greater than every existing migration so new migrations run last. Each
migration is `migrate(up, down)`:

```javascript
migrate((app) => {          // UP — apply
  const collection = new Collection({
    name: 'groups',
    id: 'pbc_groups00001',  // stable explicit IDs; relations reference these
    type: 'base',
    listRule:   '@request.auth.id = owner',
    viewRule:   '@request.auth.id = owner',
    createRule: '@request.auth.id = owner',
    updateRule: '@request.auth.id = owner',
    deleteRule: '@request.auth.id = owner',
    fields: [
      { name: 'name',  type: 'text', required: true },
      { name: 'owner', type: 'relation', collectionId: 'hbacudkt08pfcy3', cascadeDelete: true },
      { name: 'created', type: 'autodate', onCreate: true },
    ],
    indexes: ['CREATE UNIQUE INDEX `idx_x` ON `groups` (`name`, `owner`)'],
  })
  return app.save(collection)
}, (app) => {               // DOWN — revert (mirror the up exactly)
  return app.delete(app.findCollectionByNameOrId('pbc_groups00001'))
})
```

- **Add a field to an existing collection** by fetching it, `collection.fields.add(new Field({...}))`,
  and `app.save(collection)`. Always provide a matching `down`.
- **`users` collection id is `hbacudkt08pfcy3`** — relations to users reference this id.
- **Ordering dependencies are real**: a collection must be created before another collection or an
  access rule references it (e.g. `group_members` before any rule that traverses it). Keep
  dependent migrations in the correct timestamp order.
- **`*_public` views are migrations too**: set `collection.viewQuery = '<SELECT ...>'` and
  `app.save(collection)`. See "Public views" below.

## Item categories

The `items` collection's `categories` select values are **fixed and shared across all
instances** (share-mvp issue #472) and must equal `ITEM_CATEGORIES` in share-mvp
`src/lib/categories.ts`. The backend's canonical copy lives in
`tests/categories.test.mjs` (`CANONICAL_CATEGORIES`), which asserts the live schema —
base collection and the `items_public` / `items_searchable` view field metadata — against
it, so drift fails the test suite. To change the list: write a migration updating the
`items` select `values` (never edit the historical snapshot/view migrations; the views
re-derive their metadata from the base column and need no migration), update
`CANONICAL_CATEGORIES`, and follow the full cross-repo checklist in share-mvp
`docs/data-model.md` → "Item categories".

## Custom HTTP endpoints

These supplement the standard PocketBase collection API. Frontend `/api/*` routes are a *separate*
thing (SvelteKit) — these are PocketBase routes:

| Method | Path | File | Purpose |
|---|---|---|---|
| GET  | `/api/invite/{code}` | invite.pb.js | Resolve invite code → `{id, username}`; 404 if unknown (no enumeration) |
| GET  | `/api/group-invite/{token}` | group.pb.js | Public preview of a group invite (validity + group name) |
| POST | `/api/group-invite/{token}/join` | group.pb.js | Join via invite; auth required; idempotent; transactional `uses`/cap/expiry check |
| GET  | `/api/contact/{userId}` | contact.pb.js | Telegram/Signal handles, gated by the owner's per-channel visibility flags; auth required |
| POST | `/api/travel-times` | travel.pb.js | ORS travel-time matrix (user → owners), bucketed to minutes; auth required |
| POST | `/api/legal/accept` | legal.pb.js | Record the user's acceptance of the active legal docs (snapshot from `legal_documents`), refresh their version cache, clear any lock — transactional, superuser; auth required |
| POST | `/api/legal/decline` | legal.pb.js | Record rejection of the active legal docs and set `legalLocked` — transactional, superuser; auth required |
| POST | `/api/_test/run-retention/{job}` | retention.pb.js | Test-only: run a retention job with an explicit `cutoff`. Registered ONLY when `RETENTION_TEST_ROUTE=true`; superuser required. Not present in production |
| POST | `/api/import/apply` | integration_import.pb.js | CSV-import write path (#487 Phase 3): body `{rows}` (no owner), stamps `owner = e.auth.id`, dedupes keep-last, diffs + writes create/update/archive in a transaction → `SyncSummary`. Auth required; institution-only (403 otherwise); no archive-guard (user-confirmed full upload) |
| POST | `/api/import/preview` | integration_import.pb.js | dryRun of `/api/import/apply` — same diff, **no write** → `{summary, rowActions, archiveRows}`. Auth required; institution-only |
| POST | `/api/import/refresh` | integration_import.pb.js | Refreshes only the caller's own items (`findSyncConfigs` for `e.auth.id` + `refreshInstitution`) → `SyncSummary`. Auth required; institution-only. Replaces the old frontend `/api/refresh?institution=` |

## Scheduled jobs (`retention.pb.js` + `jobs/retention.js`)

GDPR data-retention (#461, DSE v2.8): five nightly `cronAdd` jobs — inactive accounts (02:00,
anonymize via `anonymizeAccount`; accounts with an open loan are skipped and user + admin get a
mail), conversations incl. messages + related notifications (02:10), notifications (02:20),
feedback (02:30), and the inactivity **warning** (02:40 — emails accounts
`RETENTION_INACTIVE_WARN_DAYS` before the deletion threshold, stating the deletion date; runs
independently of the deletion job and never delays it). Windows come from `constants.js`
(`RETENTION_*`); a window of `0` disables the job, a NaN/negative value is refused (logged, never
runs) — as is a warn lead time that exceeds the inactive window (would select active users).
Per-record failures are isolated (one bad row can't abort the batch); jobs are idempotent and log
**counts only, never personal data**. `users.lastLoginAt` (the inactivity signal) is stamped in
`account.pb.js`'s `onRecordAuthRequest`, throttled to once per 24h. `users.lastLoginAt`,
`users.retentionNotifiedAt` and `users.deletionWarnedAt` are `hidden: true` — the `users`
collection is readable by any authenticated user, so these internal fields must never be
serialized. The open-loan skip notice is deduped via `retentionNotifiedAt` (cooldown); the warning
is sent once per inactivity cycle via `deletionWarnedAt` (a stamp older than the effective last
activity belongs to a previous cycle, so a login re-arms the warning without touching the auth
hook; a send failure skips the stamp and retries the next night).

## Access control & the public views

Collection rules use `@request.auth`:
- `@request.auth.id != ""` — require any authenticated user
- `@request.auth.id = owner` — only the record's owner
- `owner.trusts_via_truster.trustee.id ?= @request.auth.id` — the item's owner trusts the current
  user (traversal through the `trusts` join collection: rows where `truster = owner`, `?=` is
  "any-match"). Trust is a first-class join (`trusts`: `truster`, `trustee`), replacing the old
  `users.trusts[]` multi-relation — same directional model as `group_members`.
- `groups.group_members_via_group.user.id ?= @request.auth.id` — current user is a member of one of
  the item's groups (traversal through the `group_members` join table)
- `groups:length = 0` — the multi-relation is empty (used to distinguish "public" from "group-only")

**CRITICAL: `items_public` and `users_public` are masking views consumed by *unauthenticated*
browsing.** `items_public` returns `NULL` for `name`/`description`/`image` of any item that is
`trusteesOnly` **or** shared to a group, while still exposing category/status (so the UI can show
"restricted item exists" without leaking content). `users_public` omits email and raw coordinates.
When you change item/user visibility, **update the corresponding view migration** or you will leak
restricted data to guests. `items_searchable` (auth-only) *filters* rows instead of masking them.

## Cascade deletes vs. the group-deletion fixup

Relation `cascadeDelete: true` enforces deletion at the **SQLite foreign-key level** (deleting a
user deletes their groups → members → invites). Because that is DB-level, hooks do **not** fire for
cascaded rows.

The one place application logic must run on delete is **group deletion** (`onRecordDelete` in
`group.pb.js`): when a group is deleted, any item whose *only* sharing was that group would silently
become public — so the hook flips those items to `trusteesOnly = true`, and rolls the delete back if
the flip fails. A raw DB-level cascade (e.g. deleting the owner) bypasses this hook — keep that in
mind before adding user-deletion features.

The second delete hook is **member removal / leaving** (`onRecordDelete` on `group_members` in
`group.pb.js`): when a membership is deleted explicitly (owner removes a member, or a member
leaves), that member's items are un-shared from the group — otherwise they stay visible to the
group but break on request (the owner is no longer a member) and the ex-member can't reach the
group to un-share them. Same fail-safe + `trusteesOnly` flip as the group-delete fixup. It fires
**only for explicit membership deletes**: group/user cascade deletes are DB-level and don't trigger
hooks, so the whole-group teardown stays owned by the group-delete fixup.

Note the same DB-level caveat for **`trusts` edges on account deletion**: the `trusts` relations
`cascadeDelete`, but self-service deletion is *anonymize-in-place* (the `users` row is kept with
`deleted=true`), so the cascade never fires. `anonymizeAccount` (`services/account.js`) therefore
deletes the account's trust edges explicitly, in both directions
(`deleteByFilter('trusts', 'truster = {:u} || trustee = {:u}')`).

## Auth-mail templates (#447)

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

## Configuration (`pb_hooks/constants.js`)

All env/config is centralized here; most have safe defaults:

| Export | Env var | Default | Purpose |
|---|---|---|---|
| `LOG_LEVEL` | `LOG_LEVEL` | `4` | 1=DEBUG … 4=ERROR |
| `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` / `VAPID_SUBJECT` | `VAPID_*` | — / `mailto:allerleih@posteo.de` | Web-push |
| `DRY_MODE` | `DRY_MODE` | `false` | When `true`, skips sending email/notifications (local dev) |
| `MAIL_THROTTLE_MINUTES` | `MAIL_THROTTLE_MINUTES` | `15` | Max one notification email per user per N minutes |
| `FRONTEND_URL` | `FRONTEND_URL` | `''` | SvelteKit frontend origin (no trailing slash). Used for the #447 auth-mail links (host of the `users` verification/reset URLs) and as the `APP_URL` fallback — **not** for integration sync (that runs fully in the backend since #487 Phase 3) |
| `SYNC_CRON` | `SYNC_CRON` | `''` | Cron expression for the full catalogue pull; empty disables the job. Runs LOCALLY (`integrations/sync.js`) — no HTTP, only a valid expression |
| `REFRESH_CRON` | `REFRESH_CRON` | `''` | Cron expression for the per-item refresh; empty disables the job. Runs LOCALLY (`integrations/refresh.js`) — no HTTP, only a valid expression |
| `INTEGRATION_ALLOW_INSECURE_URL` | `INTEGRATION_ALLOW_INSECURE_URL` | `false` | Allow `http://` + private/loopback source base URLs, bypassing the `integrations/urlGuard.js` SSRF check — for **both** sync (`fetchAllItems`) and refresh (`fetchItemById`). **Local dev / integration tests only — never in production** |
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

## Cron jobs (`integration_sync.pb.js` + `integrations/` + `services/syncConfig.js`)

Two jobs, registered from `constants.js`. **Both run locally in the backend** (no HTTP POST to the
frontend; the old `jobs/integrationSync.js` frontend-POST bodies were removed in #487 Phase 3):

- **`integration_sync`** (full catalogue pull) — `require(\`${__hooks}/integrations/sync.js\`).runSync()`:
  pages each leihbackend institution's `item_public` feed, diffs, and applies creates/updates/archives
  in a per-institution `runInTransaction`. **Archive-guard** (`SYNC_ARCHIVE_ABORT_RATE = 0.5`): an
  empty feed or a run that would archive ≥50% of stored items skips **only the archive phase**
  (creates/updates still apply) — distinct from the refresh breaker. Needs **only a valid `SYNC_CRON`**.
- **`integration_refresh`** (per-item refresh) — `require(\`${__hooks}/integrations/refresh.js\`).runRefresh()`:
  re-fetches each stored item; **circuit-breaker** (`REFRESH_ABORT_RATE = 0.5`) aborts the whole
  institution (zero writes) at ≥50% gone/error. Needs **only a valid `REFRESH_CRON`**.

Both share a concurrency-safe `$app.store()` overlap lock (`integrationRunLock`, acquired atomically
via `getOrSet`) — a sync and a refresh tick never overlap (both write `items`). Both discover
institutions from the **`sync_config`** collection via `db.js findSyncConfigs(app, {integration,
institutionId, includeDisabled})` (full sync: `integration: 'leihbackend'` only → WINBIAP never enters
the pull; refresh: all enabled, routed by the `integration` field). `DRY_MODE` logs and skips all
upstream fetches + writes for both.

Fail-soft is per job: a syntactically invalid cron expression logs an error and leaves that job
unscheduled without affecting the sibling. Superusers can inspect and manually fire both in the admin
UI (Settings → Crons) or via `GET /api/crons` / `POST /api/crons/{id}` — the tests use the latter
(`tests/integration-sync.test.mjs`, `tests/integration-refresh.test.mjs`, `tests/sync-config.test.mjs`,
`tests/cron-sync*.test.mjs`). Each logs one counts-only summary line per institution
(`[cron:sync|refresh] <inst>: fetched=… …`), never item content or PII. The CSV-import write path
(`integrations/import.js` behind `integration_import.pb.js`) reuses the same `diff.js`/`db.js`. The
`sync_config` backfill (`services/syncConfig.js`, run once by data migration
`1784658387_backfill_sync_config.js`) seeded config rows from the historical `users.leihbackendUrl`
values (that field was removed from `users` in #487 Phase 3). Operational details live in the frontend repo:
`docs/operations/integration-sync.md`.

> **Redirect residual (SSRF).** The refresh uses `$http.send`, which auto-follows redirects and
> exposes no policy hook (spike #487 §4.4). The literal-URL guard in `integrations/urlGuard.js`
> can't catch a public base URL that 302-redirects onto an internal host — the frontend's
> `redirect: 'manual'` semantics is not reproducible in Goja. Base URLs are admin-onboarded
> (bounded risk); documented in the ops runbook.

## Keeping this file in sync

Whenever you add/rename a hook file, a `routerAdd` endpoint, a collection/view, a `services/` or
`utils/` helper, or a config key in `constants.js`, **update the matching section here in the same
change** so this file never drifts from the code. Schema is the source of truth in
`pb_migrations/` — the frontend repo consumes this API, so coordinate breaking schema changes with
`~/allerleih`.
