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
├── constants.js             # ALL env vars + config in one place (see below)
├── group.pb.js              # group lifecycle hooks + /api/group-invite/* routes
├── invite.pb.js             # GET /api/invite/{code} — public invite-code lookup
├── contact.pb.js            # GET /api/contact/{userId} — visibility-gated contact handles
├── travel.pb.js             # POST /api/travel-times — ORS travel-time matrix
├── legal.pb.js              # platform legal consent (#399): /api/legal/accept|decline (superuser,
│                            #   server-authoritative), users-create consent stamping, locked-user guard
├── notification.pb.js       # messages → in-app notification + throttled email
├── services/                # shared business logic: group.js, notification.js, mail.js
├── utils/                   # common.js (nowIso, formatDateTime, uniqueBy), db.js
├── views/                   # email HTML templates (layout.html + mail/)
├── jobs/  routes/           # placeholders — cron jobs / routes currently live in *.pb.js
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

## Access control & the public views

Collection rules use `@request.auth`:
- `@request.auth.id != ""` — require any authenticated user
- `@request.auth.id = owner` — only the record's owner
- `owner.trusts.id ?= @request.auth.id` — `?=` is "any-match"; traverses a multi-relation
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

## Configuration (`pb_hooks/constants.js`)

All env/config is centralized here; most have safe defaults:

| Export | Env var | Default | Purpose |
|---|---|---|---|
| `LOG_LEVEL` | `LOG_LEVEL` | `4` | 1=DEBUG … 4=ERROR |
| `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` / `VAPID_SUBJECT` | `VAPID_*` | — / `mailto:allerleih@posteo.de` | Web-push |
| `DRY_MODE` | `DRY_MODE` | `false` | When `true`, skips sending email/notifications (local dev) |
| `MAIL_THROTTLE_MINUTES` | `MAIL_THROTTLE_MINUTES` | `15` | Max one notification email per user per N minutes |

Also expected at runtime: `ORS_API_KEY` (travel-times). Locally these are dummy values, so push,
geocoding, and email don't work for real.

## Keeping this file in sync

Whenever you add/rename a hook file, a `routerAdd` endpoint, a collection/view, a `services/` or
`utils/` helper, or a config key in `constants.js`, **update the matching section here in the same
change** so this file never drifts from the code. Schema is the source of truth in
`pb_migrations/` — the frontend repo consumes this API, so coordinate breaking schema changes with
`~/allerleih`.
