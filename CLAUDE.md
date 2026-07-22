# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project overview

**AllerLeih backend** — the PocketBase server for the AllerLeih item-sharing platform.
PocketBase runs as a single binary ("Zero-Go"): all custom server logic lives in **JS hooks**
(`pb_hooks/`) and all schema lives in **versioned migrations** (`pb_migrations/`) that auto-apply
on start. There is no separate application server and no build step. The companion SvelteKit
frontend lives in the `share-mvp` repo (sibling directory) and talks to this backend over the
PocketBase REST/realtime API. (`README.md` has the full quick-start/deploy instructions — link,
don't import, it's 300+ lines.)

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
- For personal local settings (custom ports, local superuser creds) that shouldn't be shared with
  the team, use a gitignored `CLAUDE.local.md` at the repo root — it loads alongside this file.

## Repository structure

```
pb_hooks/                    # custom server logic (auto-loaded JS), one file per domain area
├── main.pb.js                    # bootstrap / startup logging
├── mail_config.pb.js             # bootstrap: configures SMTP from env when SMTP_HOST is set (#8)
├── auth_mail_templates.pb.js     # bootstrap: re-injects FRONTEND_URL into `users` auth-mail links (#447)
├── constants.js                  # ALL env vars + config in one place (see .claude/rules/config.md)
├── group.pb.js                   # group lifecycle hooks + /api/group-invite/* routes
├── trust.pb.js                   # `trusts` join guard (rejects self-trust edges)
├── invite.pb.js                  # GET /api/invite/{code} — public invite-code lookup
├── contact.pb.js                 # GET /api/contact/{userId} — visibility-gated contact handles
├── travel.pb.js                  # POST /api/travel-times — ORS travel-time matrix
├── legal.pb.js                   # platform legal consent (#399): /api/legal/accept|decline
├── notification.pb.js            # messages → in-app notification + throttled email
├── notification_guard.pb.js      # onRecordCreateRequest guard on user-created notifications
├── lending.pb.js                 # #373 conversations onRecordUpdateRequest guard (abort flow)
├── integration_sync.pb.js        # cron jobs POSTing the frontend's /api/sync + /api/refresh
├── account.pb.js                 # DELETE /api/account + export, deleted-login block, email normalization (#557)
├── retention.pb.js               # GDPR retention cron jobs (#461) + guarded test route
├── services/                     # shared business logic: account.js, group.js, legal.js, notification.js, mail.js
├── utils/                        # common.js, email.js (normalizeEmail, #557), db.js
├── views/                        # email HTML templates (layout.html + mail/)
├── jobs/                         # cron job bodies: retention.js, integrationSync.js
├── routes/                       # placeholder — routes currently live in *.pb.js
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

Full migration-writing conventions, the custom HTTP endpoint table, the retention/cron job
internals, the auth-mail template mechanics, and the full `constants.js` config table have moved
to path-scoped `.claude/rules/*.md` files (see "Where to look" below) so they only load into
context when you're actually touching that area.

## Access control & the public views

Collection rules use `@request.auth`:
- `@request.auth.id != ""` — require any authenticated user
- `@request.auth.id = owner` — only the record's owner
- `owner.trusts_via_truster.trustee.id ?= @request.auth.id` — the item's owner trusts the current
  user (traversal through the `trusts` join collection: rows where `truster = owner`, `?=` is
  "any-match"). Trust is a first-class join (`trusts`: `truster`, `trustee`).
- `groups.group_members_via_group.user.id ?= @request.auth.id` — current user is a member of one of
  the item's groups (traversal through the `group_members` join table)
- `groups:length = 0` — the multi-relation is empty (used to distinguish "public" from "group-only")

**CRITICAL: `items_public` and `users_public` are masking views consumed by *unauthenticated*
browsing.** `items_public` returns `NULL` for `name`/`description`/`image` of any item that is
`trusteesOnly` **or** shared to a group, while still exposing category/status (so the UI can show
"restricted item exists" without leaking content). `users_public` omits email and raw coordinates.
When you change item/user visibility, **update the corresponding view migration** or you will leak
restricted data to guests. `items_searchable` (auth-only) *filters* rows instead of masking them.

## Backend-only issues

An issue that only touches this repo (no frontend changes) should still be driven through
`share-mvp`'s `/issue-to-pr` orchestrator and `/create-pr` skill when working across the two-repo
workspace — they carry the plan-approval gate, the review-role dispatch (the frontend's
`sveltekit-pb-reviewer` role explicitly covers `pb_hooks`/`pb_migrations` diffs), and the shared
branch-naming convention. This repo also has its own local `/create-pr` skill for standalone use
when working in this repo alone.

## Where to look (load on demand)

| Working on… | Read |
|---|---|
| Writing a migration | `.claude/rules/migrations.md`, `/new-migration` skill |
| Item categories (cross-repo fixed list) | `.claude/rules/migrations.md` → "Item categories" |
| Adding/changing a custom HTTP route | `.claude/rules/http-endpoints.md` |
| `retention.pb.js` / GDPR jobs | `.claude/rules/retention.md` |
| Group/account deletion & cascade behavior | `.claude/rules/cascade-deletes.md` |
| Auth-mail templates | `.claude/rules/auth-mail.md` |
| Integration sync cron jobs | `.claude/rules/integration-sync.md` |
| Full env var / `constants.js` reference | `.claude/rules/config.md` |

## Keeping this file in sync

Whenever you add/rename a hook file, a `routerAdd` endpoint, a collection/view, a `services/` or
`utils/` helper, or a config key in `constants.js`, **update the matching section here (or the
matching `.claude/rules/*.md` file) in the same change** so these files never drift from the code.
Schema is the source of truth in `pb_migrations/` — the frontend repo consumes this API, so
coordinate breaking schema changes with `share-mvp`.
