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
  (`startPB`, `stopPB`, `api`, `makeUser`, `adminAuth`, plus the #607 mail-deliverability helpers
  `startPbWithSmtpSink` — `startPB()` pre-wired to a real SMTP sink, see `tests/smtpSink.mjs` —
  `headerValue`, a fold-aware raw-MIME header extractor, `extractPart`/`decodeQuotedPrintable`, a
  MIME-part extractor and quoted-printable decoder for asserting on a mail's HTML/text body, and
  `waitForMessageCount`, an adaptive poll that waits for a sink to reach a given message count).
  They run serially (`--test-concurrency=1`) because each owns the server.
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
├── integration_sync.pb.js        # cron registration: integration_sync + integration_refresh — as of #487
│                                 #   Phase 2 BOTH run LOCALLY (see .claude/rules/integration-sync.md)
├── integration_import.pb.js      # #487 Phase 3: CSV-import write path — POST /api/import/{apply,preview,
│                                 #   refresh} (requireAuth, institution-only, owner = e.auth.id)
├── integrations/                 # #487 Goja port of the integration pipeline: sync.js (runSync full pull),
│                                 #   refresh.js (runRefresh per-item), db.js (findSyncConfigs + applyDiff),
│                                 #   import.js (Phase 3 apply/preview/refresh), diff.js, leihbackend.js,
│                                 #   winbiap.js, urlGuard.js, lock.js, types.js
├── account.pb.js                 # DELETE /api/account + export, deleted-login block, email normalization (#557)
├── retention.pb.js               # GDPR retention cron jobs (#461) + guarded test route
├── digest.pb.js                  # #607: weekly_digest cron registration + guarded test route (jobs/digest.js)
├── unsubscribe.pb.js             # #607: GET/POST /api/unsubscribe/{purpose}/{token} — one-click digest unsubscribe
├── services/                     # shared business logic: account.js, group.js, legal.js, notification.js,
│                                 #   mail.js — renderMailBody() is the ONLY sanctioned way to render a
│                                 #   views/mail/*.html body: layout.html's `{{raw .CONTENT}}` never
│                                 #   re-resolves placeholders, so a body template's own {{.SITE_URL}}/
│                                 #   {{.ASSET_URL}} gets nothing unless this helper supplies it,
│                                 #   syncConfig.js (used only by the historical backfill migration),
│                                 #   unsubscribe.js (#607: HMAC token verify/apply + the confirmation page render)
├── utils/                        # common.js, email.js (normalizeEmail, #557), db.js, urls.js (#607: assetBase/
│                                 #   siteBase — backend vs. frontend origin), htmlToText.js (#607: mail plaintext)
├── views/                        # email HTML templates (layout.html + mail/) — render any mail/*.html
│                                 #   ONLY via services/mail.js's renderMailBody(), never a raw
│                                 #   $template.loadFiles() call (see that function's doc comment);
│                                 #   unsubscribe.html (#607: the standalone confirmation page, NOT a mail
│                                 #   template — buildMessage()/renderMailBody() don't apply to it)
├── jobs/                         # cron job bodies: retention.js, digest.js (#607, extracted from digest.pb.js)
├── routes/                       # placeholder — routes currently live in *.pb.js
pb_migrations/               # <timestamp>_<description>.js — schema, applied in filename order
pb_public/                   # static assets served by PocketBase
tests/                       # *.test.mjs integration tests + harness.mjs
pb_data/                     # live DB + uploads (gitignored, created on first serve)
```

## CRITICAL: hook files run in isolated contexts — `require()` inside the handler

Each `pb_hooks/*.pb.js` handler runs in its own isolated JS context. **NOTHING declared at a
`*.pb.js` file's top level — not `require()` results, and not a plain `const`/`function` you wrote
yourself in that same file — is reliably visible inside a `routerAdd`/`onRecord*`/`cronAdd`
callback registered there.** Confirmed empirically while building #607's `unsubscribe.pb.js`: a
top-level `const PURPOSES = [...]` in that file threw `ReferenceError: PURPOSES is not defined`
the moment a registered `routerAdd` callback referenced it — this is not just a require() quirk,
it applies to any top-level declaration. `require()` shared code, and define any other helper,
*inside* the handler, using the `__hooks` magic path:

```javascript
// CORRECT — require AND any shared constants/helpers declared inside the handler
onRecordAfterCreateSuccess((e) => {
  const { createNotification } = require(`${__hooks}/services/notification.js`)
  const { DRY_MODE } = require(`${__hooks}/constants.js`)
  // ...
  e.next()
}, 'messages')

// WRONG — neither a top-level require() nor a top-level const/function is in scope when the
// handler fires, even though both live in the very same file as the registration call below.
const { createNotification } = require(`${__hooks}/services/notification.js`)  // ❌
const SOME_ALLOWLIST = ['a', 'b']  // ❌ — also not visible inside the callback below
routerAdd('GET', '/api/example', (e) => { /* SOME_ALLOWLIST is undefined here */ })
```

(Plain helper functions/constants declared at the top level of a `services/`/`utils/`/`jobs/`
module — i.e. a file that is itself `require()`'d fresh inside a handler, not a `*.pb.js` hook
file — are unaffected and work exactly like normal CommonJS: `services/mail.js`, `services/account.js`,
`jobs/retention.js` and `jobs/digest.js` all rely on this and it works fine.)

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
**`items_public.image` masks via a SQL `CASE` expression, which PocketBase types as a `json`
column — not a `file` column — so it can never serve a file at all (404; this was #622).** Item
files are always served through `/api/files/items_searchable/{id}/{filename}` (a real, cloned
`file` field), never through `items_public`, regardless of the item's visibility. PocketBase's
file-serving endpoint does not evaluate a collection's view rule — only the field's `protected`
flag (`false` for both views) — so this URL is reachable unauthenticated with no token and no
expiry; the barrier against leaking a restricted item's image is at the call site (e.g. the weekly
digest's `allowUploadedImages`, `pb_hooks/jobs/digest.js`), not the server.
Both item views additionally exclude rows whose owner is `deleted`
(`WHERE COALESCE(users.deleted, 0) = 0`) so an anonymized account's conversation-retained items
stay out of the catalogue and search — a **standing invariant every `viewQuery` rewrite must
carry over** (#624; guarded by `tests/deleted-owner-items.test.mjs`).

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
